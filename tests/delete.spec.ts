import faker from 'faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient } from '../src';
import { Tracker } from '../src/Tracker';

describe('mock Delete statement', () => {
  let db: Knex;
  let tracker: Tracker;

  beforeAll(() => {
    db = knex({
      client: MockClient as any,
    });
    tracker = getTracker();
  });

  afterEach(() => {
    tracker.reset();
  });

  it('should allow to mock delete query using string matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.delete('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock delete query using regex matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.delete(/table_name/).response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock delete query using custom matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should return a deep clone of the data', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to query the same handler multiple times', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on.delete('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);
    const data2 = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to reset handlers', async () => {
    let affectedRows = faker.datatype.number();

    tracker.on.delete('table_name').response(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);

    tracker.resetHandlers();

    affectedRows = faker.datatype.number();

    tracker.on.delete('table_name').response(affectedRows);

    const data2 = await db('table_name').delete().where('id', 1);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to mock delete query once', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .responseOnce(affectedRows);

    const data = await db('table_name').delete().where('id', 1);

    expect(data).toEqual(affectedRows);

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('No mock handler found'),
    });
  });

  it('should collect call history by method', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const deleteIds = [faker.datatype.number({ min: 1 }), faker.datatype.number({ min: 1 })];
    await db('table_name').delete().where('id', deleteIds[0]);
    await db('table_name').delete().where('id', deleteIds[1]);

    expect(tracker.history.delete).toHaveLength(2);
    expect(tracker.history.delete[0].bindings).toEqual([deleteIds[0]]);
    expect(tracker.history.delete[1].bindings).toEqual([deleteIds[1]]);
  });

  it('should allow to simulate error', async () => {
    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .simulateError('connection error');

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });
  });

  it('should allow to simulate error once', async () => {
    tracker.on
      .delete((rawQuery) => rawQuery.method === 'delete' && rawQuery.sql.includes('table_name'))
      .simulateErrorOnce('connection error');

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
    });

    await expect(db('table_name').delete().where('id', 1)).rejects.toMatchObject({
      message: expect.stringContaining('No mock handler found'),
    });
  });

  it('should support `raw` delete statement', async () => {
    tracker.on.delete('table_name').response([]);

    await db.raw('Delete from ?? where id=?', ['table_name', faker.datatype.number({ min: 1 })]);

    expect(tracker.history.delete).toHaveLength(1);
  });

  it('should support response as a function', async () => {
    tracker.on.delete('table_name').response(() => 2);

    const data = await db('table_name').delete().where('table', 'table_name');

    expect(tracker.history.delete).toHaveLength(1);
    expect(data).toEqual(2);
  });

  it('should support an async response as a function', async () => {
    tracker.on.delete('table_name').response(async () => {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(3);
        }, 0)
      );
    });

    const data = await db('table_name').delete().where('table', 'table_name');

    expect(tracker.history.delete).toHaveLength(1);
    expect(data).toEqual(3);
  });
});
