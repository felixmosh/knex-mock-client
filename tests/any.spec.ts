import { faker } from '@faker-js/faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient, Tracker } from '../src';

describe('mock any statement', () => {
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

  it('should allow to mock any query using string matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.any('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock any query using regex matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.any(/table_name/).response(affectedRows);

    const data = await db('table_name').where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock any query using custom matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on
      .any((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const data = await db('table_name').update({ col: '123' }).where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should return a deep clone of the data', async () => {
    const expectedData = [{ id: faker.datatype.number() }];

    tracker.on
      .any((rawQuery) => rawQuery.method === 'select' && rawQuery.sql.includes('table_name'))
      .response(expectedData);

    const data = await db('table_name').where('id', 1);

    expect(data).not.toBe(expectedData);
  });

  it('should allow to query the same handler multiple times', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on.any('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);
    const data2 = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to reset handlers', async () => {
    let affectedRows = faker.datatype.number();

    tracker.on.any('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);

    tracker.resetHandlers();

    affectedRows = faker.datatype.number();

    tracker.on.any('table_name').response(affectedRows);

    const data2 = await db('table_name').delete().where('id', 1);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to mock any query once', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on
      .any((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .responseOnce(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('Mock handler not found'),
    });
  });

  it('should collect call history by method', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .any((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const deleteIds = [faker.datatype.number({ min: 1 }), faker.datatype.number({ min: 1 })];
    await db('table_name').delete().where('id', deleteIds[0]);
    await db('table_name').delete().where('id', deleteIds[1]);

    expect(tracker.history.delete).toHaveLength(0);

    expect(tracker.history.any).toHaveLength(2);
    expect(tracker.history.any[0].bindings).toEqual([deleteIds[0]]);
    expect(tracker.history.any[1].bindings).toEqual([deleteIds[1]]);
  });

  it('should allow to simulate error', async () => {
    const errorMessage = 'connection error';
    tracker.on
      .any((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .simulateError(errorMessage);

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining(errorMessage),
    });

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining(errorMessage),
    });
  });

  it('should allow to simulate error once', async () => {
    const errorMessage = 'connection error';
    tracker.on
      .any((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .simulateErrorOnce(errorMessage);

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining(errorMessage),
    });

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('Mock handler not found'),
    });
  });

  it('should support `raw` delete statement', async () => {
    tracker.on.any('table_name').response([]);

    await db.raw('Delete from ?? where id=?', ['table_name', faker.datatype.number({ min: 1 })]);

    expect(tracker.history.any).toHaveLength(1);
  });

  it('should support response as a function', async () => {
    tracker.on.any('table_name').response(() => 2);

    const data = await db('table_name').delete().where('table', 'table_name');

    expect(tracker.history.any).toHaveLength(1);
    expect(data).toEqual(2);
  });

  it('should support an async response as a function', async () => {
    tracker.on.any('table_name').response(async () => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(3);
        }, 0)
      );
    });

    const data = await db('table_name').delete().where('table', 'table_name');

    expect(tracker.history.any).toHaveLength(1);
    expect(data).toEqual(3);
  });
});
