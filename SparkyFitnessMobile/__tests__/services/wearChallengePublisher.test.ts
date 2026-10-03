import { WearChallengePublisher } from '../../src/services/wearChallengePublisher';
import {
  getCompanionChallengeSession,
  invalidateCompanionChallengeSession,
} from '../../src/services/companionChallengeSession';
import { emptyCompanionChallenges } from '../../src/utils/companionChallenges';
import type { CompanionChallengeSnapshot } from '../../src/types/companionChallenges';
import fixture from '../fixtures/watch-challenges.json';
const snapshot = fixture as CompanionChallengeSnapshot;
const revision = () => getCompanionChallengeSession().revision;
beforeEach(() => invalidateCompanionChallengeSession(false));
function setup() {
  const publish = jest.fn<Promise<void>, [string]>().mockResolvedValue();
  const config = jest
    .fn<Promise<string | null>, []>()
    .mockResolvedValue('config');
  const failure = jest.fn();
  return {
    publish,
    config,
    failure,
    subject: new WearChallengePublisher(publish, config, failure),
  };
}
it('publishes initially, skips identical state, and republishes corrected results', async () => {
  const { subject, publish } = setup();
  await subject.offer(snapshot, revision(), 'config');
  await subject.offer(snapshot, revision(), 'config');
  expect(publish).toHaveBeenCalledTimes(1);
  const corrected = {
    ...snapshot,
    generatedAt: 2000,
    items: snapshot.items.map((item) => ({
      ...item,
      rows: item.rows.map((row) => ({ ...row, total: 0 })),
    })),
  };
  await subject.offer(corrected, revision(), 'config');
  expect(publish).toHaveBeenCalledTimes(2);
  expect(JSON.parse(publish.mock.calls[1][0]).items[0].rows[0].total).toBe(0);
});
it('persists a logout tombstone while offline and does not re-date cached data', async () => {
  const { subject, publish, config } = setup();
  await subject.offer(snapshot, revision(), 'config');
  expect(JSON.parse(publish.mock.calls[0][0]).generatedAt).toBe(1000);
  config.mockRejectedValue(new Error('offline'));
  invalidateCompanionChallengeSession(true);
  await subject.offer(snapshot, revision(), 'config');
  expect(JSON.parse(publish.mock.calls[1][0])).toEqual(
    emptyCompanionChallenges()
  );
});
it('clears an in-flight old identity before new account state', async () => {
  const { subject, publish, config } = setup();
  let resolveConfig!: (value: string) => void;
  config.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveConfig = resolve;
      })
  );
  const pending = subject.offer(snapshot, revision(), 'config');
  await Promise.resolve();
  invalidateCompanionChallengeSession(true);
  const clear = subject.offer(emptyCompanionChallenges(), revision());
  resolveConfig('config');
  await pending;
  await clear;
  expect(publish).toHaveBeenCalledTimes(1);
  expect(JSON.parse(publish.mock.calls[0][0]).state).toBe('unavailable');
  invalidateCompanionChallengeSession(false);
  config.mockResolvedValue('other');
  await subject.offer(
    { ...snapshot, accountKey: 'other:actor' },
    revision(),
    'other'
  );
  expect(JSON.parse(publish.mock.calls[1][0]).accountKey).toBe('other:actor');
});
it('rejects stale queued revisions even after the new session is unblocked', async () => {
  const { subject, publish } = setup();
  const old = revision();
  invalidateCompanionChallengeSession(false);
  await subject.offer(snapshot, old, 'config');
  expect(JSON.parse(publish.mock.calls[0][0]).state).toBe('unavailable');
});
it('clears when active server no longer matches', async () => {
  const { subject, publish, config } = setup();
  config.mockResolvedValue('other');
  await subject.offer(snapshot, revision(), 'config');
  expect(JSON.parse(publish.mock.calls[0][0]).state).toBe('unavailable');
});
it('recovers a failed durable enqueue without modifying query data', async () => {
  const { subject, publish, failure } = setup();
  publish.mockRejectedValueOnce(new Error('disk'));
  const original = JSON.stringify(snapshot);
  await subject.offer(snapshot, revision(), 'config');
  await subject.offer(snapshot, revision(), 'config');
  expect(publish).toHaveBeenCalledTimes(2);
  expect(failure).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(snapshot)).toBe(original);
});
it('serializes native storage promises so a clear follows an already dispatched save', async () => {
  const { subject, publish } = setup();
  let finish!: () => void;
  publish.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = subject.offer(snapshot, revision(), 'config');
  await Promise.resolve();
  await Promise.resolve();
  invalidateCompanionChallengeSession(true);
  const clear = subject.offer(emptyCompanionChallenges(), revision());
  finish();
  await pending;
  await clear;
  expect(JSON.parse(publish.mock.calls.at(-1)![0]).state).toBe('unavailable');
});
