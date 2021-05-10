import { Knex } from 'knex';

declare namespace knex {
  Knex.Client;
  declare const Client: Knex.Client;
}

export interface RawQuery {
  method: 'select' | 'insert' | 'update' | 'delete';
  options: Record<string, any>;
  timeout: boolean;
  cancelOnTimeout: boolean;
  bindings: any[];
  __knexQueryUid: string;
  sql: string;
  queryContext: any;
}
