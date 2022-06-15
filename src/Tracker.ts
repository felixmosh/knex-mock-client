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

type History = Record<QueryMethodType, RawQuery[]> & {
  transactions: TransactionState[],
  all: RawQuery[],
};

export class Tracker {
  public readonly history: History = {
    ...Object.fromEntries(
      queryMethods.map((method) => [method, [] as RawQuery[]])
    ) as Record<QueryMethodType, RawQuery[]>,
    transactions: [],
    all: [],
  };

  public readonly on = Object.fromEntries(
    queryMethods.map((method) => [method, this.prepareStatement(method)])
  ) as Record<QueryMethodType, (rawQueryMatcher: QueryMatcher) => ResponseTypes>;

  private readonly config: TrackerConfig;
  private responses = new Map<RawQuery['method'], Handler[]>();

  constructor(trackerConfig: TrackerConfig) {
    this.config = trackerConfig;
    this.reset();
  }

  public _handle(connection: MockConnection, rawQuery: RawQuery): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        if (this.receiveTransactionCommand(connection, rawQuery)) {
          return resolve(undefined);
        }

        this.history.all.push(rawQuery);

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
  }

  public resetHandlers() {
    queryMethods.forEach((method) => this.responses.set(method, []));
  }

  public resetHistory() {
    this.history.transactions = [];
    this.history.all = [];
    queryMethods.forEach((method) => (this.history[method] = []));
  }

  private receiveTransactionCommand(connection: MockConnection, rawQuery: RawQuery): boolean {
    const txId = connection.transactionStack.peek(0);

    const txState: TransactionState | undefined = txId === undefined
      ? undefined
      : this.history.transactions[txId];

    const trxCommand = transactionCommands.find((trxCommand) => rawQuery.sql.startsWith(trxCommand))

    switch (trxCommand) {
      case 'BEGIN;':
      case 'SAVEPOINT': {
        const newTxState: TransactionState = {
          id: this.history.transactions.length,
          state: 'ongoing',
          queries: [],
          ...txId !== undefined && { parent: txId },
        };

        this.history.transactions.push(newTxState);
        connection.transactionStack.pointTo(newTxState.id);
        break;
      }

      case 'COMMIT;':
      case 'RELEASE SAVEPOINT': {
        if (txState) {
          txState.state = 'committed';
          connection.transactionStack.pointTo(txState.parent);
        }
        break;
      }

      case 'ROLLBACK': {
        if (txState) {
          txState.state = 'rolled back';
          connection.transactionStack.pointTo(txState.parent);
        }
        break;
      }

      case undefined:
        txState?.queries.push(rawQuery);
        return false;
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
