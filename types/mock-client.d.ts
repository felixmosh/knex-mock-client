export interface RawQuery {
  method: 'select' | 'insert' | 'update' | 'delete' | 'any';
  sql: string;
  bindings: any[];
  options: Record<string, any>;
  timeout: boolean;
  cancelOnTimeout: boolean;
  __knexQueryUid: string;
  queryContext: any;
}

export type FunctionQueryMatcher = (rawQuery: RawQuery) => boolean;
export type QueryMatcher = string | RegExp | FunctionQueryMatcher;
