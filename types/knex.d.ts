import { Knex } from 'knex';

declare namespace knex {
  declare const Client: Knex.Client;
}
