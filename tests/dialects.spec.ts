import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { createTracker, MockClient, Tracker } from '../src';

describe('specific dialect', () => {
  let db: Knex;
  let tracker: Tracker;

  describe('postgres', () => {
    beforeAll(() => {
      db = knex({
        client: MockClient,
        dialect: 'pg',
      });
      tracker = createTracker(db);
    });

    afterEach(() => {
      tracker.reset();
    });

    it('should allow to mock select query distinctOn', async () => {
      const givenData = [{ id: faker.number.int() }];
      tracker.on.select('table_name').response(givenData);

      const data = await db('table_name').distinctOn('age');

      expect(data).toEqual(givenData);
      expect(tracker.history.select).toHaveLength(1);
    });

    it('should allow to mock select query noWait', async () => {
      const givenData = [{ id: faker.number.int() }];
      tracker.on.select('table_name').response(givenData);

      const data = await db('table_name').select('*').forUpdate().noWait();

      expect(data).toEqual(givenData);
      expect(tracker.history.select).toHaveLength(1);
      expect(tracker.history.select[0].sql).toContain('for update nowait');
    });

    it('should allow to mock insert query with onConflict', async () => {
      tracker.on.insert('table_name').responseOnce(1);

      await db('table_name')
        .insert({ id: 1234, created_at: '2022-05-10', updated_at: '2022-05-10' })
        .onConflict('id')
        .merge(['id', 'created_at']);

      expect(tracker.history.insert).toHaveLength(1);
      expect(tracker.history.insert[0].sql).toContain('on conflict');
    });

    it('should support transactions', async () => {
      tracker.on
        .insert(({ sql }) => ['table_name', 'returning'].every((part) => sql.includes(part)))
        .responseOnce(1);
      tracker.on.delete('table_name').responseOnce(1);

      await db.transaction(async (trx) => {
        await db('table_name')
          .insert({ name: faker.person.firstName() })
          .returning('*')
          .transacting(trx);
        await db('table_name').delete().where({ name: faker.person.firstName() }).transacting(trx);
      });

      expect(tracker.history.insert).toHaveLength(1);
      expect(tracker.history.insert[0].sql).toContain('returning');
      expect(tracker.history.delete).toHaveLength(1);
    });

    it('should support transactions with an explicit isolation level', async () => {
      tracker.on.insert('table_name').responseOnce(1);
      tracker.on.delete('table_name').responseOnce(1);
      tracker.on.select('foo').responseOnce([]);

      const trx = await db.transaction({ isolationLevel: 'read uncommitted' });

      await db('table_name').transacting(trx).insert({ name: 'Steve' }).transacting(trx);
      await db('table_name').transacting(trx).delete().where({ name: 'Steve' }).transacting(trx);

      await trx.commit();
    });
  });

  describe('mysql', () => {
    beforeAll(() => {
      db = knex({
        client: MockClient,
        dialect: 'mysql',
      });
      tracker = createTracker(db);
    });

    afterEach(() => {
      tracker.reset();
    });

    it('should use the correct wrapper', async () => {
      tracker.on.select('table_name').response([]);

      await db('table_name');

      expect(tracker.history.select).toHaveLength(1);
      expect(tracker.history.select[0].sql).toStrictEqual('select * from `table_name`');
    });
  });

  describe('mssql', () => {
    beforeAll(() => {
      db = knex({
        client: MockClient,
        dialect: 'mssql',
      });
      tracker = createTracker(db);
    });

    afterEach(() => {
      tracker.reset();
    });

    it('should work with mssql dialect', async () => {
      const returnVal = { id: 1 };
      tracker.on.update('table_name').responseOnce(returnVal);

      const updates = await db.transaction((tx) => {
        return tx('table_name').update({ value: 'test' }).where({ id: 1 });
      });

      expect(tracker.history.update).toHaveLength(1);
      expect(tracker.history.update[0].sql).toContain(`table_name`);
      expect(updates).toEqual(returnVal);
    });
  });

  describe('none-exists', () => {
    it('should should throw an error when passing none exists dialect', () => {
      expect(() =>
        knex({
          client: MockClient,
          dialect: 'none-exists',
        })
      ).toThrowError(/Unknown configuration option 'dialect'/);
    });
  });
});
