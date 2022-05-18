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

    await db.transaction(async (trx) => {
      await db('table_name').insert({ name: faker.name.firstName() }).transacting(trx);
      await db('table_name').delete().where({ name: faker.name.firstName() }).transacting(trx);
    });

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);
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
  });

  it('should support nested transactions', async () => {
    tracker.on.insert('table_name').responseOnce(1);
    tracker.on.delete('table_name').responseOnce(1);

    await db.transaction(async (trx) => {
      await db('table_name').insert({ name: faker.name.firstName() }).transacting(trx);
      await trx.transaction(async (innerTrx) => {
        await db('table_name')
          .delete()
          .where({ name: faker.name.firstName() })
          .transacting(innerTrx);
      });
    });

    expect(tracker.history.insert).toHaveLength(1);
    expect(tracker.history.delete).toHaveLength(1);
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
  });
});
