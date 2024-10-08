import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { createTracker, MockClient, Tracker } from '../src';
import { queryMethods } from '../src/constants';

describe('common behaviour', () => {
  it('should throw error when querying without tracker initialization', async () => {
    const db = knex({
      client: MockClient,
    });

    await expect(db('table_name').where('id', 1)).rejects.toThrowError(
      'Tracker not configured for knex mock client'
    );
  });

  it('should support concurrent tests by having different tracker', () => {
    const db1 = knex({
      client: MockClient,
    });

    const db2 = knex({
      client: MockClient,
    });

    createTracker(db1);
    createTracker(db2);

    expect(db1.client.driver.tracker).not.toBe(db2.client.driver.tracker);
  });

  describe('with db initialized', () => {
    let db: Knex;
    let tracker: Tracker;

    beforeAll(() => {
      db = knex({
        client: MockClient,
        connection: {
          host: 'HOST',
          user: 'USER',
          password: 'PASSWORD',
          database: 'DBNAME',
        },
      });
      tracker = createTracker(db);
    });

    afterEach(() => {
      tracker.reset();
    });

    queryMethods.forEach((method) => {
      describe(method, () => {
        it(`should errorMessage error when given invalid matcher`, async () => {
          const givenData = [{ id: faker.number.int() }];
          expect(() => tracker.on[method](null as any).response(givenData)).toThrowError(
            'Given invalid query matcher'
          );

          expect(() => tracker.on[method](2 as any).response(givenData)).toThrowError(
            'Given invalid query matcher'
          );

          expect(() => tracker.on[method]('').response(givenData)).toThrowError(
            'Given invalid query matcher'
          );
        });

        it(`should reject when no match found`, async () => {
          const givenData = [{ id: faker.number.int() }];
          tracker.on[method]('wrong_name').response(givenData);

          await expect(db('table_name')).rejects.toMatchObject({
            message: expect.stringContaining('Mock handler not found'),
          });
        });
      });
    });
  });

  describe('fakeTimers', () => {
    let db: Knex;
    let tracker: Tracker;

    beforeAll(() => {
      jest.useFakeTimers();

      db = knex({
        client: MockClient,
      });
      tracker = createTracker(db);
    });

    it('should support jest fake timers', async () => {
      const affectedRows = faker.number.int();
      tracker.on.select('table_name').response(affectedRows);

      const data = await db('table_name').where('id', 1);

      expect(data).toEqual(affectedRows);
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });
});
