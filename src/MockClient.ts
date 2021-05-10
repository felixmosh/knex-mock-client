import knex, { Knex } from 'knex';
import { RawQuery } from '../types/knex';
import { Tracker, TrackerConfig } from './Tracker';

export class MockClient extends (knex as any).Client {
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
    // @ts-ignore
    rawQuery.method = rawQuery.method === 'del' ? 'delete' : rawQuery.method;
    return MockClient.tracker._handle(rawQuery);
  }
}

Object.assign(MockClient.prototype, {
  driverName: MockClient.name,
});
