import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient, Tracker } from '../src';

describe('transaction', () => {
  let db: Knex;
  let tracker: Tracker;

  beforeAll(() => {
    db = knex({
      client: MockClient,
    });
    tracker = getTracker();
  });

  afterEach(() => {
    tracker.reset();
  });

  it('should support transactions', async () => {
    tracker.on.insert('table_name').responseOnce(1);
    tracker.on.delete('table_name').responseOnce(1);
    tracker.on.select('foo').responseOnce([]);

    await db.transaction(async (trx) => {
      await db('table_name').insert({ name: faker.name.firstName() }).transacting(trx);
      await db('table_name').delete().where({ name: faker.name.firstName() }).transacting(trx);
    });

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);

    expect(tracker.history.transactions).toEqual([{
      id: 0,
      state: 'committed',
      queries: [
        expect.objectContaining({
          method: 'insert',
        }),
        expect.objectContaining({
          method: 'delete',
        }),
      ],
    }]);
  });

  it('should support transactions with rollback', async () => {
    tracker.on.insert('table_name').responseOnce(1);
    tracker.on.delete('table_name').responseOnce(1);

    await db
      .transaction(async (trx) => {
        await db('table_name').insert({ name: faker.name.firstName() }).transacting(trx);
        await db('table_name').delete().where({ name: faker.name.firstName() }).transacting(trx);
        throw new Error('TEST');
      })
      .catch((e) => {
        expect(e.message).toBe('TEST');
      });

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);

    expect(tracker.history.transactions).toEqual([{
      id: 0,
      state: 'rolled back',
      queries: [
        expect.objectContaining({
          method: 'insert',
        }),
        expect.objectContaining({
          method: 'delete',
        }),
      ],
    }]);
  });

  it('should support nested transactions', async () => {
    tracker.on.insert('table_name').responseOnce(1);
    tracker.on.delete('table_name').responseOnce(1);
    tracker.on.select('table_name').responseOnce([]);

    await db.transaction(async (trx) => {
      await db('table_name').insert({ name: faker.name.firstName() }).transacting(trx);
      await trx.transaction(async (innerTrx) => {
        await db('table_name')
          .delete()
          .where({ name: faker.name.firstName() })
          .transacting(innerTrx);
      });
      await trx.transaction(async (innerTrx) => {
        await db('table_name')
          .select()
          .where({ name: faker.name.firstName() })
          .transacting(innerTrx);
      });
    });

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);

    expect(tracker.history.transactions).toEqual([
      {
        id: 0,
        state: 'committed',
        queries: [
          expect.objectContaining({
            method: 'insert',
          }),
        ],
      },
      {
        id: 1,
        parent: 0,
        state: 'committed',
        queries: [
          expect.objectContaining({
            method: 'delete',
          }),
        ],
      },
      {
        id: 2,
        parent: 0,
        state: 'committed',
        queries: [
          expect.objectContaining({
            method: 'select',
          }),
        ],
      },
    ]);
  });

  it('should support transactions with commit', async () => {
    tracker.on.insert('table_name').responseOnce(1);
    tracker.on.delete('table_name').responseOnce(1);

    const trx = await db.transaction();
    await trx('table_name').insert({ name: faker.name.firstName() });
    await trx('table_name').delete().where({ name: faker.name.firstName() });
    await trx.commit();

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);

    expect(tracker.history.transactions).toEqual([{
      id: 0,
      state: 'committed',
      queries: [
        expect.objectContaining({
          method: 'insert',
        }),
        expect.objectContaining({
          method: 'delete',
        }),
      ],
    }]);
  });

  it('should keep track of interleaving transactions', async () => {
    tracker.on.any(/.*/).response(1);

    const trx1 = await db.transaction();
    const trx2 = await db.transaction();

    await trx1('table_one').insert({ name: faker.name.firstName() });
    await trx2('table_two').insert({ name: faker.name.firstName() });

    const nestedTrx1 = await trx1.transaction();
    const nestedTrx2 = await trx2.transaction();

    await nestedTrx1('table_one').delete().where({ name: faker.name.firstName() });
    await nestedTrx2('table_two').delete().where({ name: faker.name.firstName() });

    await nestedTrx2.commit();
    await nestedTrx1.commit();

    await trx1.commit();
    await trx2.commit();

    expect(tracker.history.transactions).toEqual([
      {
        id: 0,
        state: 'committed',
        queries: [
          expect.objectContaining({
            sql: 'insert into "table_one" ("name") values (?)',
          }),
        ],
      },
      {
        id: 1,
        state: 'committed',
        queries: [
          expect.objectContaining({
            sql: 'insert into "table_two" ("name") values (?)',
          }),
        ],
      },
      {
        id: 2,
        parent: 0,
        state: 'committed',
        queries: [
          expect.objectContaining({
            sql: 'delete from "table_one" where "name" = ?',
          }),
        ],
      },
      {
        id: 3,
        parent: 1,
        state: 'committed',
        queries: [
          expect.objectContaining({
            sql: 'delete from "table_two" where "name" = ?',
          }),
        ],
      },
    ]);
  });
});
