import faker from 'faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient } from '../src';
import { Tracker } from '../src/Tracker';

describe('mock Update statement', () => {
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

  it('should allow to mock insert query using string matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.update('table_name').response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock insert query using regex matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on.update(/table_name/).response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to mock insert query using custom matcher', async () => {
    const affectedRows = faker.datatype.number();
    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);
  });

  it('should return a deep clone of the data', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);
  });

  it('should allow to query the same handler multiple times', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on.update('table_name').response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);
    const data2 = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to reset handlers', async () => {
    let affectedRows = faker.datatype.number();

    tracker.on.update('table_name').response(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);

    tracker.resetHandlers();

    affectedRows = faker.datatype.number();

    tracker.on.update('table_name').response(affectedRows);

    const data2 = await db('table_name').update([{ name: faker.name.firstName() }]);
    expect(data2).toEqual(affectedRows);
  });

  it('should allow to mock insert query once', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .responseOnce(affectedRows);

    const data = await db('table_name').update([{ name: faker.name.firstName() }]);

    expect(data).toEqual(affectedRows);

    await expect(
      db('table_name').update([{ name: faker.name.firstName() }])
    ).rejects.toMatchObject({ message: expect.stringContaining('No mock handler found') });
  });

  it('should collect call history by method', async () => {
    const affectedRows = faker.datatype.number();

    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .response(affectedRows);

    const names = [faker.name.firstName(), faker.name.firstName()];

    await db('table_name').update({ name: names[0] });
    await db('table_name').update({ name: names[1] });

    expect(tracker.history.update).toHaveLength(2);
    expect(tracker.history.update[0].bindings).toEqual([names[0]]);
    expect(tracker.history.update[1].bindings).toEqual([names[1]]);
  });

  it('should allow to simulate error', async () => {
    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .simulateError('connection error');

    await expect(db('table_name').update([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );

    await expect(db('table_name').update([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );
  });

  it('should allow to simulate error once', async () => {
    tracker.on
      .update((rawQuery) => rawQuery.method === 'update' && rawQuery.sql.includes('table_name'))
      .simulateErrorOnce('connection error');

    await expect(db('table_name').update([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );

    await expect(db('table_name').update([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('No mock handler found'),
      }
    );
  });
});
