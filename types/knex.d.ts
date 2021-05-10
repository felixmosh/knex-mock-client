import { Knex } from 'knex';

declare namespace knex {
  declare const Client: Knex.Client;
}

export interface RawQuery {
  method: 'select' | 'insert' | 'update' | 'delete';
  sql: string;
  bindings: any[];
  options: Record<string, any>;
  timeout: boolean;
  cancelOnTimeout: boolean;
  __knexQueryUid: string;
  queryContext: any;
}
