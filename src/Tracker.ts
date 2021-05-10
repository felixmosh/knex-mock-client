import cloneDeep from 'lodash.clonedeep';
import { RawQuery } from '../types/knex';
import { queryMethods } from './constants';

export type TrackerConfig = Record<string, unknown>;

interface Handler<T = any> {
  data: T | ((rawQuery: RawQuery) => T);
  match: (rawQuery: RawQuery) => boolean;
  errorMessage?: string;
  once?: true;
}

type QueryMethodType = typeof queryMethods[number];
type History = Record<QueryMethodType, RawQuery[]>;

export class Tracker {
  public readonly history: History = {
    select: [],
    insert: [],
    update: [],
    delete: [],
  };
  private readonly config: TrackerConfig;
  private responses = new Map<RawQuery['method'], Handler[]>();

  public on = {
    select: this.prepareStatement('select'),
    insert: this.prepareStatement('insert'),
    update: this.prepareStatement('update'),
    delete: this.prepareStatement('delete'),
  };

  constructor(trackerConfig: TrackerConfig) {
    this.config = trackerConfig;
    this.reset();
  }

  public _handle(rawQuery: RawQuery): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const handlers = this.responses.get(rawQuery.method) || [];
        for (let i = 0; i < handlers.length; i++) {
          const handler = handlers[i];

          if (handler.match(rawQuery)) {
            this.history[rawQuery.method].push(rawQuery);

            if (handler.errorMessage) {
              reject(new Error(handler.errorMessage));
            } else {
              resolve(cloneDeep(handler.data));
            }

            if (handler.once) {
              handlers.splice(i, 1);
            }
            return;
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

  private prepareMatcher(rawQueryMatcher: string | RegExp | Handler['match']): Handler['match'] {
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
    return (rawQueryMatcher: string | RegExp | Handler['match']) => {
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
}
