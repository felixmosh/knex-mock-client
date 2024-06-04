import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { createTracker, MockClient, Tracker } from '../src';

describe('mock Select statement', () => {
  let db: Knex;
  let tracker: Tracker;

  beforeAll(() => {
    db = knex({
      client: MockClient,
    });
    tracker = createTracker(db);
  });

  afterEach(() => {
    tracker.reset();
  });

  it('should allow to mock select query using string matcher', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on.select('table_name').response(givenData);

    const data = await db('table_name');

    expect(data).toEqual(givenData);
  });

  it('should allow to mock select query using regex matcher', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on.select(/table_name/).response(givenData);

    const data = await db('table_name');

    expect(data).toEqual(givenData);
  });

  it('should allow to mock select query using custom matcher', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const data = await db('table_name');

    expect(data).toEqual(givenData);
  });

  it('should return a deep clone of the data', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const data = await db('table_name');
    expect(data).not.toBe(givenData);
  });

  it('should allow to query the same handler multiple times', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const data = await db('table_name');
    const data2 = await db('table_name');

    expect(data).toEqual(givenData);
    expect(data2).toEqual(givenData);
    expect(data).not.toBe(data2);
  });

  it('should allow to reset handlers', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const data = await db('table_name');
    expect(data).toEqual(givenData);

    tracker.resetHandlers();

    givenData.push({ id: faker.number.int() });
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const data2 = await db('table_name');
    expect(data2).toEqual(givenData);
  });

  it('should allow to mock select query once', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .responseOnce(givenData);

    const data = await db('table_name');
    expect(data).toEqual(givenData);

    await expect(db('table_name')).rejects.toMatchObject({
      message: expect.stringContaining('Mock handler not found'),
    });
  });

  it('should allow to chain mock select query', async () => {
    const givenData = [{ id: faker.number.int() }];
    const givenData2 = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .responseOnce(givenData)
      .on.select('table_name')
      .response(givenData2);

    expect(await db('table_name')).toEqual(givenData);
    expect(await db('table_name')).toEqual(givenData2);
    expect(await db('table_name')).toEqual(givenData2);
  });

  it('should collect call history by method', async () => {
    const givenData = [{ id: faker.number.int() }];
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(givenData);

    const ids = [faker.number.int({ min: 1 }), faker.number.int({ min: 1 })];

    await db('table_name').where('id', ids[0]);
    await db('table_name').where('id', ids[1]);

    expect(tracker.history.select).toHaveLength(2);
    expect(tracker.history.select[0].bindings).toEqual([ids[0]]);
    expect(tracker.history.select[1].bindings).toEqual([ids[1]]);
  });

  it('should allow to simulate error', async () => {
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .simulateError('connection error');

    await expect(db('table_name')).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });

    await expect(db('table_name')).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });
  });

  it('should allow to simulate error with object', async () => {
    const error = new Error('connection error');
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .simulateError(error);

    await expect(db('table_name')).rejects.toBe(error);
    await expect(db('table_name')).rejects.toBe(error);
  });

  it('should allow to simulate error once', async () => {
    tracker.on
      .select((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .simulateErrorOnce('connection error');

    await expect(db('table_name')).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });

    await expect(db('table_name')).rejects.toMatchObject({
      message: expect.stringContaining('Mock handler not found'),
    });
  });

  it('should support `first` query', async () => {
    const data = [{ id: faker.number.int({ min: 1 }) }, { id: faker.number.int({ min: 1 }) }];

    tracker.on.select('table_name').response(data);

    const firstValue = await db('table_name').first();
    const allValues = await db('table_name');

    expect(tracker.history.select).toHaveLength(2);
    expect(firstValue).toEqual(data[0]);
    expect(allValues).toEqual(data);
  });

  it('should support `pluck` query', async () => {
    const data = [{ id: faker.number.int({ min: 1 }) }, { id: faker.number.int({ min: 1 }) }];

    tracker.on.select('table_name').response(data);

    const values = await db('table_name').pluck('id');

    expect(tracker.history.select).toHaveLength(1);
    expect(values).toEqual(data.map(({ id }) => id));
  });

  it('should support `raw` select statement', async () => {
    tracker.on.select('table_name').response([]);

    await db.raw('Select * from ??', ['table_name']);

    expect(tracker.history.select).toHaveLength(1);
  });

  it('should support response as a function', async () => {
    tracker.on.select('table_name').response((q) => ({
      table: q.bindings[0],
    }));

    const data = await db('table_name').where('table', 'table_name');

    expect(tracker.history.select).toHaveLength(1);
    expect(data).toEqual({ table: 'table_name' });
  });

  it('should support an async response as a function', async () => {
    tracker.on.select('table_name').response(async (q) => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve({
            table: q.bindings[0],
          });
        }, 0)
      );
    });

    const data = await db('table_name').where('table', 'table_name');

    expect(tracker.history.select).toHaveLength(1);
    expect(data).toEqual({ table: 'table_name' });
  });
});
