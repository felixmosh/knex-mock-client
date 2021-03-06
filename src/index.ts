import { MockClient } from './MockClient';
import { Tracker } from './Tracker';

export { MockClient } from './MockClient';
export type { Tracker } from './Tracker';
export type { RawQuery, QueryMatcher, FunctionQueryMatcher } from '../types/mock-client';

export function getTracker(): Tracker {
  if (!MockClient.tracker) {
    throw new Error('Trying to access tracker before knex initialized');
  }

  return MockClient.tracker;
}
