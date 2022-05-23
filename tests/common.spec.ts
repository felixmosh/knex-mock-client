import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient, Tracker } from '../src';
import { queryMethods } from '../src/constants';

describe('common behaviour', () => {
  it('should errorMessage error when accessing tracker before initialization', async () => {
    expect(getTracker).toThrowError('Trying to access tracker before knex initialized');
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
      tracker = getTracker();
    });

    afterEach(() => {
      tracker.reset();
    });

    queryMethods.forEach((method) => {
      describe(method, () => {
        it(`should errorMessage error when given invalid matcher`, async () => {
          const givenData = [{ id: faker.datatype.number() }];
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
          const givenData = [{ id: faker.datatype.number() }];
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
      tracker = getTracker();
    });

    it('should support jest fake timers', async () => {
      const affectedRows = faker.datatype.number();
      tracker.on.select('table_name').response(affectedRows);

      const data = await db('table_name').where('id', 1);

      expect(data).toEqual(affectedRows);
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });
});
