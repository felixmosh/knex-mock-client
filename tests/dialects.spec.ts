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
