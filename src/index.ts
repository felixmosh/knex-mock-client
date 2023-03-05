import { Knex } from 'knex';
import { Tracker, TrackerConfig } from './Tracker';

export { MockClient } from './MockClient';
export { Tracker } from './Tracker';
export type { RawQuery, QueryMatcher, FunctionQueryMatcher } from '../types/mock-client';

export function createTracker(db: Knex, trackerConfig: TrackerConfig = {}): Tracker {
  const tracker = new Tracker(trackerConfig);
  db.client.config.tracker = tracker;
  return tracker;
}
