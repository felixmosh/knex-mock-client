import cloneDeep from 'lodash.clonedeep';
import { FunctionQueryMatcher, QueryMatcher, RawQuery } from '../types/mock-client';
import { queryMethods, transactionCommands } from './constants';

export type TrackerConfig = Record<string, unknown>;

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
type History = Record<QueryMethodType, RawQuery[]>;
type On = Record<QueryMethodType, (rawQueryMatcher: QueryMatcher) => ResponseTypes>;

export class Tracker {
  public readonly history: History = queryMethods.reduce((result, method) => {
    result[method] = [];
    return result;
  }, {} as History);

  public on = queryMethods.reduce((result, method) => {
    result[method] = this.prepareStatement(method);
    return result;
  }, {} as On);

  private readonly config: TrackerConfig;
  private responses = new Map<RawQuery['method'], Handler[]>();

  constructor(trackerConfig: TrackerConfig) {
    this.config = trackerConfig;
    this.reset();
  }

  public _handle(rawQuery: RawQuery): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        if (typeof rawQuery.method === 'undefined' && transactionCommands.includes(rawQuery.sql)) {
          return resolve(undefined);
        }

        const possiableMethods: RawQuery['method'][] = [rawQuery.method, 'any'];
        for (const method of possiableMethods) {
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

        reject(new Error(`No mock handler found`));
      }, 0);
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
    queryMethods.forEach((method) => (this.history[method].length = 0));
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
