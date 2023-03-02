import knex, { Knex } from 'knex';
import { createTracker, MockClient, Tracker } from '../src';

describe('store all history', () => {
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

  it('should store all queries in the order they were run', async () => {
    tracker.on.insert('table_name').response(1);
    tracker.on.select('table_name').response([{ id: 1 }]);

    await db('table_name').insert({ id: 1 });
    const data = await db('table_name').where('id', 1);

    expect(data).toStrictEqual([{ id: 1 }]);

    expect(tracker.history.all.length).toEqual(2);
    expect(tracker.history.all[0].sql).toEqual('insert into "table_name" ("id") values (?)');
    expect(tracker.history.all[0].bindings).toEqual([1]);
    expect(tracker.history.all[1].sql).toEqual('select * from "table_name" where "id" = ?');
    expect(tracker.history.all[1].bindings).toEqual([1]);
  });

  it('should reset the history when calling `resetHistory()`', async () => {
    tracker.on.insert('table_name').response(1);
    tracker.on.select('table_name').response([{ id: 1 }]);

    await db('table_name').insert({ id: 1 });
    await db('table_name').where('id', 1);

    tracker.resetHistory();

    expect(tracker.history.all.length).toEqual(0);
  });
});
