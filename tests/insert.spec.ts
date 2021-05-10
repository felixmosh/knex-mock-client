import faker from 'faker';
import knex, { Knex } from 'knex';
import { getTracker, MockClient } from '../src';
import { Tracker } from '../src/Tracker';

describe('mock Insert statement', () => {
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
    const insertId = [faker.datatype.number()];
    tracker.on.insert('table_name').response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);
  });

  it('should allow to mock insert query using regex matcher', async () => {
    const insertId = [faker.datatype.number()];
    tracker.on.insert(/table_name/).response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);
  });

  it('should allow to mock insert query using custom matcher', async () => {
    const insertId = [faker.datatype.number()];
    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);
  });

  it('should return a deep clone of the data', async () => {
    const insertId = [faker.datatype.number()];

    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);
  });

  it('should allow to query the same handler multiple times', async () => {
    const insertId = [faker.datatype.number()];

    tracker.on.insert('table_name').response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);
    const data2 = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);
    expect(data2).toEqual(insertId);
    expect(data).not.toBe(insertId);
  });

  it('should allow to reset handlers', async () => {
    let insertId = [faker.datatype.number()];

    tracker.on.insert('table_name').response(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);

    tracker.resetHandlers();

    insertId = [faker.datatype.number()];

    tracker.on.insert('table_name').response(insertId);

    const data2 = await db('table_name').insert([{ name: faker.name.firstName() }]);
    expect(data2).toEqual(insertId);
  });

  it('should allow to mock insert query once', async () => {
    const insertId = [faker.datatype.number()];
    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .responseOnce(insertId);

    const data = await db('table_name').insert([{ name: faker.name.firstName() }]);

    expect(data).toEqual(insertId);

    await expect(db('table_name').insert([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      { message: expect.stringContaining('No mock handler found') }
    );
  });

  it('should collect call history by method', async () => {
    const insertId = [faker.datatype.number()];

    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .response(insertId);

    const insertData = [{ name: faker.name.firstName() }, { name: faker.name.firstName() }];
    await db('table_name').insert(insertData[0]);
    await db('table_name').insert(insertData[1]);

    expect(tracker.history.insert).toHaveLength(2);
    expect(tracker.history.insert[0].bindings).toEqual([insertData[0].name]);
    expect(tracker.history.insert[1].bindings).toEqual([insertData[1].name]);
  });

  it('should allow to simulate error', async () => {
    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .simulateError('connection error');

    await expect(db('table_name').insert([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );

    await expect(db('table_name').insert([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );
  });

  it('should allow to simulate error once', async () => {
    tracker.on
      .insert((rawQuery) => rawQuery.method === 'insert' && rawQuery.sql.includes('table_name'))
      .simulateErrorOnce('connection error');

    await expect(db('table_name').insert([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('connection error'),
      }
    );

    await expect(db('table_name').insert([{ name: faker.name.firstName() }])).rejects.toMatchObject(
      {
        message: expect.stringContaining('No mock handler found'),
      }
    );
  });

  it('should support `raw` insert statement', async () => {
    tracker.on.insert('table_name').response([]);

    await db.raw('Insert into ?? (id) values (?)', [
      'table_name',
      faker.datatype.number({ min: 1 }),
    ]);

    expect(tracker.history.insert).toHaveLength(1);
  });
});
