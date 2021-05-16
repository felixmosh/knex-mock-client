import knex, { Knex } from 'knex';
import { RawQuery } from '../types/mock-client';
import { Tracker, TrackerConfig } from './Tracker';

export class MockClient extends knex.Client {
  static tracker: Tracker;
  public readonly isMock = true;

  constructor(config: Knex.Config & { mockClient: TrackerConfig }) {
    super(config);

    MockClient.tracker = new Tracker(config.mockClient);
  }

  public acquireConnection() {
    return Promise.resolve({ __knexUid: 1, fakeConnection: true });
  }

  public releaseConnection() {
    return Promise.resolve();
  }

  public processResponse(response: any) {
    return response;
  }

  public _query(_connection: any, rawQuery: RawQuery) {
    let method: RawQuery['method'] = rawQuery.method;

    const rawMethod = rawQuery.method as RawQuery['method'] | 'del' | 'first' | 'pluck' | 'raw';
    switch (rawMethod) {
      case 'first':
      case 'pluck':
        method = 'select';
        break;
      case 'del':
        method = 'delete';
        break;
      case 'raw':
        method = rawQuery.sql.toLowerCase().trim().split(' ').shift() as RawQuery['method'];
        break;
    }

    return MockClient.tracker._handle({ ...rawQuery, method });
  }
}
