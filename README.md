# knex-mock-client

[![npm](https://img.shields.io/npm/v/knex-mock-client.svg)](https://www.npmjs.com/package/knex-mock-client)
[![CI](https://github.com/felixmosh/knex-mock-client/actions/workflows/main.yml/badge.svg)](https://github.com/felixmosh/knex-mock-client/actions/workflows/main.yml)

A mock client for [Knex](https://github.com/knex/knex) which allows you to write tests with DB
interactions with a breeze.

## Installation

To use this lib, first you will have to install it:

```
npm i --save-dev knex-mock-client
```

or

```
yarn add --dev knex-mock-client
```

## Example

Mocking an `insert` statement

```ts
// my-cool-controller.ts
import { db } from '../common/db-setup';

export async function addUser(user: User): Promise<{ id }> {
  const [insertId] = await db.insert(user).into('users');

  return { id: insertId };
}
```

```ts
// my-cool-controller.spec.ts
import { expect } from '@jest/globals';
import knex, { Knex } from 'knex';
import { getTracker, MockClient } from 'knex-mock-client';
import faker from 'faker';

jest.mock('../common/db-setup', () => {
  return {
    db: knex({ client: MockClient })
  };
});

describe('my-cool-controller tests', () => {
  let tracker: Tracker;

  beforeAll(() => {
    tracker = getTracker();
  });

  afterEach(() => {
    tracker.reset();
  });

  it('should add new user', async () => {
    const insertId = faker.datatype.number();
    tracker.on.insert('users').response([insertId]);
    const newUser = { name: 'foo bar', email: 'test@test.com' };
    const data = await addUser(newUser);

    expect(data.id).toEqual(insertId);

    const insertHistory = tracker.history.insert;

    expect(insertHistory).toHaveLength(1);
    expect(insertHistory[0].method).toEqual('insert');
    expect(insertHistory[0].bindings).toEqual([newUser.name, newUser.email]);
  });
});
```

Each one of `on` methods (`select`, `insert`,`update`, `delete`, `any`) are accepting a query matcher.
<br>There are 3 kind of matchers:

1. `String` - will match part of the given `sql` using `String.includes`

   ```ts
   tracker.on.select('select * from users where `id`=?').response([]);
   ```

2. `RegEx` - will match the given `sql` with the given regex
   ```ts
   tracker.on.update(/update users where .*/).response([]);
   ```
3. `Function` - you can specify a custom matcher by providing a function.
   <br/>This function will accept `RawQuery` as an argument and should return a `boolean` value.
   ```ts
   tracker.on
     .insert(
       ({ method, sql, bindings }: RawQuery) =>
         method === 'insert' && /^insert into `users`/.test(sql) && bindings.includes('secret-token')
     )
     .response([]);
   ```

## Query handlers

You can specify the db response by calling:

1. `response<T>(dbData)` - will register a permanent query handler with the same response value

   ```ts
   tracker.on.select('select * from users where `id`=?').response([{ id: 1, name: 'foo' }]);
   ```

2. `responseOnce<T>(dbData)` - will register a one-time query handler, after the first usage it will
   be removed from handlers list.
   ```ts
   tracker.on.select('select * from users where `id`=?').responseOnce([{ id: 1, name: 'foo' }]);
   ```
3. `simulateError(errorMessage: string)` - will register a permanent failure handler for the matched
   query
   ```ts
   tracker.on.select('select * from users where `id`=?').simulateError('Connection lost');
   ```
4. `simulateErrorOnce(errorMessage: string)` - will register a one-time failure handler, after the
   first usage it will be removed from handlers list.
   ```ts
   tracker.on.select('select * from users where `id`=?').simulateErrorOnce('Connection lost');
   ```

You can reset handlers by calling `tracker.resetHandlers()` which will remove all handlers for all
query methods.

## History Calls

Each db request that your app makes throughout `knex` will be registered in a scoped (by query
method) history call list. Each call is an object with the interface of `RawQuery`.

```ts
interface RawQuery {
  method: 'select' | 'insert' | 'update' | 'delete';
  sql: string;
  bindings: any[];
  options: Record<string, any>;
  timeout: boolean;
  cancelOnTimeout: boolean;
  __knexQueryUid: string;
  queryContext: any;
}
```

You can reset all history calls by calling `tracker.resetHistory()`.

You can reset `queryHandlers` & `history` by calling `tracker.reset()`.

This lib got inspiration from [`axios-mock-adapter`](https://github.com/ctimmerm/axios-mock-adapter)
api️.
