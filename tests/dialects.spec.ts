import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient, Tracker } from '../src';

describe('specific dialect', () => {
  let db: Knex;
  let tracker: Tracker;

  describe('postgres', () => {
    beforeAll(() => {
      db = knex({
        client: MockClient,
        dialect: 'pg',
      });
      tracker = getTracker();
    });

    afterEach(() => {
      tracker.reset();
    });

    it('should allow to mock select query distinctOn', async () => {
      const givenData = [{ id: faker.datatype.number() }];
      tracker.on.select('table_name').response(givenData);

      const data = await db('table_name').distinctOn('age');

      expect(data).toEqual(givenData);
      expect(tracker.history.select).toHaveLength(1);
    });

    it('should allow to mock select query noWait', async () => {
      const givenData = [{ id: faker.datatype.number() }];
      tracker.on.select('table_name').response(givenData);

      const data = await db('table_name').select('*').forUpdate().noWait();

      expect(data).toEqual(givenData);
      expect(tracker.history.select).toHaveLength(1);
    });

    it('should allow to mock insert query with onConflict', async () => {
      tracker.on.insert('table_name').responseOnce(1);

      await db('table_name')
        .insert({ id: 1234, created_at: '2022-05-10', updated_at: '2022-05-10' })
        .onConflict('id')
        .merge(['id', 'created_at']);

      expect(tracker.history.insert).toHaveLength(1);
    });
  });

  describe('mysql', () => {
    beforeAll(() => {
      db = knex({
        client: MockClient,
        dialect: 'mysql',
      });
      tracker = getTracker();
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
