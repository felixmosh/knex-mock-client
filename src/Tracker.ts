import cloneDeep from 'lodash.clonedeep';
import { FunctionQueryMatcher, QueryMatcher, RawQuery } from '../types/mock-client';
import { queryMethods, transactionCommands } from './constants';
import { MockConnection } from './MockConnection';
import { isUsingFakeTimers } from './utils';

export type TrackerConfig = Record<string, unknown>;

export type TransactionState = {
  id: number,
  parent?: number,
  state: 'ongoing' | 'committed' | 'rolled back',
  queries: RawQuery[],
};

type InternalTransactionState = TransactionState & {
  originalId: string,
  originalParent?: string,
};

type History = Record<QueryMethodType, RawQuery[]> & {
  transactions: TransactionState[],
};

interface Handler<T = any> {
  data: T | ((rawQuery: RawQuery) => T);
  match: FunctionQueryMatcher;
  errorMessage?: string;
  once?: true;
}

type ResponseTypes = {
  response: <T = any>(data: Handler<T>['data']) => Tracker;
  responseOnce: <T = any>(data: Handler<T>['data']) => Tracker;
  simulateError: (data: Handler<any>['data']) => Tracker;
  simulateErrorOnce: (data: Handler<any>['data']) => Tracker;
};

type QueryMethodType = typeof queryMethods[number];

export class Tracker {
  public readonly history: History = {
    ...Object.fromEntries(
      queryMethods.map((method) => [method, [] as RawQuery[]])
    ) as Record<QueryMethodType, RawQuery[]>,
    transactions: [],
  };

  public on = Object.fromEntries(
    queryMethods.map((method) => [method, this.prepareStatement(method)])
  );

  private readonly config: TrackerConfig;
  private responses = new Map<RawQuery['method'], Handler[]>();
  private transactions = new Map<string, InternalTransactionState>();

  constructor(trackerConfig: TrackerConfig) {
    // Provide a dynamic 
    Object.defineProperty(this.history, 'transactions', {
      get: () => this.getTransactions(),
    });
    
    this.config = trackerConfig;
    this.reset();
  }

  public _handle(connection: MockConnection, rawQuery: RawQuery): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        if (this.receiveTransactionCommand(connection, rawQuery)) {
          return resolve(undefined);
        }

        const possibleMethods: RawQuery['method'][] = [rawQuery.method, 'any'];
        for (const method of possibleMethods) {
          const handlers: Handler[] = this.responses.get(method) || [];

          for (let i = 0; i < handlers.length; i++) {
            const handler = handlers[i];

            if (handler.match(rawQuery)) {
              this.history[method].push(rawQuery);

              if (handler.errorMessage) {
                reject(new Error(handler.errorMessage));
              } else {
                const data =
                  typeof handler.data === 'function' ? await handler.data(rawQuery) : handler.data;
                resolve(cloneDeep(Tracker.applyPostOp(data, rawQuery)));
              }

              if (handler.once) {
                handlers.splice(i, 1);
              }
              return;
            }
          }
        }

        reject(new Error(`Mock handler not found`));
      }, 0);

      if (isUsingFakeTimers()) {
        /**
         * Based on https://github.com/testing-library/react-testing-library/commit/403aa5cd8479c9778174fad76b59b02a470c7d1b
         * without this, a test using fake timers would never get microtasks actually flushed.
         */
        jest.advanceTimersByTime(0);
      }
    });
  }

  public reset() {
    this.resetHandlers();
    this.resetHistory();
    this.resetTransactions();
  }

  public resetHandlers() {
    queryMethods.forEach((method) => this.responses.set(method, []));
  }

  public resetHistory() {
    queryMethods.forEach((method) => (this.history[method].length = 0));
  }

  public resetTransactions() {
    this.transactions.clear();
  }

  private getTransactions(): TransactionState[] {
    return Array.from(this.transactions.values())
      .sort((a, b) => a.id - b.id)
      // Hide original transaction IDs as those are not predictable within a test
      // because they are generated from a global state within a transitive
      // dependency of Knex.
      .map(({ originalId, originalParent, ...txState }) => txState);
  }

  private receiveTransactionCommand(connection: MockConnection, rawQuery: RawQuery): boolean {
    const txId = connection.transactionStack.peek(0);

    // Knex always assign a transaction ID before emiting any transaction control commands.
    if (txId === undefined) return false;

    const parentTxId = connection.transactionStack.peek(1);

    const txState: InternalTransactionState = this.transactions.get(txId) ?? {
      originalId: txId,
      id: this.transactions.size,
      state: 'ongoing',
      queries: [],
      ...parentTxId && {
        originalParent: parentTxId,
        parent: this.transactions.get(parentTxId)?.id,
      },
    };

    const trxCommand = transactionCommands.find((trxCommand) => rawQuery.sql.startsWith(trxCommand))

    if (trxCommand === undefined) {
      txState.queries.push(rawQuery);

      return false;
    }

    switch (trxCommand) {
      case 'BEGIN;':
      case 'SAVEPOINT':
        this.transactions.set(txId, txState);
        break;

      case 'COMMIT;':
      case 'RELEASE SAVEPOINT':
        txState.state = 'committed';

        // Knex only actively sets the internal transaction ID when going down a transaction.
        // Since it keeps track of the transaction internally, there is no need to
        // inform the connection that it is no longer running that transaction.
        // As a workaround, we point the connection to the parent transaction by ourselves here.
        // If Knex decides to set the transaction ID when going up the stack,
        // this call just won't do anything as it is idempotent.
        connection.transactionStack.pointTo(txState.originalParent);
        break;

      case 'ROLLBACK':
        txState.state = 'rolled back';

        // See reasoning above.
        connection.transactionStack.pointTo(txState.originalParent);
        break;
    }

    return true;
  }

  private prepareMatcher(rawQueryMatcher: QueryMatcher): Handler['match'] {
    if (typeof rawQueryMatcher === 'string' && rawQueryMatcher) {
      return (rawQuery: RawQuery) => rawQuery.sql.includes(rawQueryMatcher);
    } else if (rawQueryMatcher instanceof RegExp) {
      return (rawQuery: RawQuery) => rawQueryMatcher.test(rawQuery.sql);
    } else if (typeof rawQueryMatcher === 'function') {
      return rawQueryMatcher;
    }

    throw new Error('Given invalid query matcher');
  }

  private prepareStatement(queryMethod: QueryMethodType) {
    return (rawQueryMatcher: QueryMatcher): ResponseTypes => {
      const matcher = this.prepareMatcher(rawQueryMatcher);
      return {
        response: <T = any>(data: Handler<T>['data']): Tracker => {
          const handlers = this.responses.get(queryMethod) || [];
          handlers.push({ match: matcher, data });

          return this;
        },
        responseOnce: <T = any>(data: Handler<T>['data']): Tracker => {
          const handlers = this.responses.get(queryMethod) || [];
          handlers.push({ match: matcher, data, once: true });

          return this;
        },
        simulateError: (errorMessage: Handler['errorMessage']): Tracker => {
          const handlers = this.responses.get(queryMethod) || [];
          handlers.push({ match: matcher, data: null, errorMessage });

          return this;
        },
        simulateErrorOnce: (errorMessage: Handler['errorMessage']): Tracker => {
          const handlers = this.responses.get(queryMethod) || [];
          handlers.push({ match: matcher, data: null, once: true, errorMessage });

          return this;
        },
      };
    };
  }

  private static applyPostOp(data: any, rawQuery: RawQuery) {
    if (rawQuery.postOp === 'first' && Array.isArray(data)) {
      return data[0];
    } else if (rawQuery.postOp === 'pluck' && rawQuery.pluck && Array.isArray(data)) {
      return data.map((item) => item[rawQuery.pluck as string]);
    }
    return data;
  }
}
