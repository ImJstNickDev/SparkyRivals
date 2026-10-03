import nativeFixture from '../fixtures/watch-challenges.json';
import {
  buildWatchChallenges,
  emptyWatchChallenges,
  selectWatchChallenges,
} from '../../src/utils/watchChallenges';
import { actor, challenge, peer, results } from '../helpers/challenges';
import type { ChallengeResponse } from '@workspace/shared';

const build = (
  changes: Partial<Parameters<typeof buildWatchChallenges>[0]> = {}
) =>
  buildWatchChallenges({
    accountKey: `config:${actor}`,
    actor,
    challenges: [challenge],
    listUpdatedAt: 2000,
    hasMore: false,
    results: new Map([[challenge.id, { data: results, dataUpdatedAt: 1000 }]]),
    ...changes,
  });
it('distinguishes not authenticated/not synced from a genuinely empty list', () => {
  expect(emptyWatchChallenges().state).toBe('unavailable');
  expect(build({ accountKey: '' }).state).toBe('unavailable');
  expect(build({ listUpdatedAt: 0 }).state).toBe('unavailable');
  expect(build({ challenges: [] })).toMatchObject({
    state: 'ready',
    items: [],
  });
});
it('copies authoritative versus totals, gaps, ranks and presence without daily history', () => {
  const item = build().items[0];
  expect(item.participantCount).toBe(2);
  expect(item.leadMargin).toBe(2287);
  expect(item.rows).toHaveLength(2);
  expect(item.rows[0]).toMatchObject({
    id: actor,
    isSelf: true,
    total: 54280,
    rank: 1,
    leader: true,
    today: { value: 0, present: true },
  });
  expect(item.rows[1]).toMatchObject({
    id: peer,
    isSelf: false,
    total: 51993,
    gapToLeader: 2287,
    today: { value: 0, present: false },
  });
  expect(item.rows[0]).not.toHaveProperty('daily');
  expect(item.rows[0]).not.toHaveProperty('coverage');
});
it('never exposes a cached leaderboard to a pending invitation', () => {
  expect(
    build({ challenges: [{ ...challenge, my_membership: 'pending' }] }).items[0]
  ).toMatchObject({ membership: 'pending', rows: [] });
  expect(
    build({ challenges: [{ ...challenge, my_membership: 'pending' }] }).items[0]
  ).not.toHaveProperty('participantCount');
});
it.each(['declined', 'left'] as const)(
  'omits %s membership',
  (my_membership) => {
    expect(
      build({ challenges: [{ ...challenge, my_membership }] }).items
    ).toEqual([]);
  }
);
it('omits cancelled challenges even with cached scores', () => {
  expect(
    build({ challenges: [{ ...challenge, lifecycle: 'cancelled' }] }).items
  ).toEqual([]);
});
it('shows upcoming rules/count with no fake scores', () => {
  const upcoming = { ...challenge, lifecycle: 'upcoming' as const };
  const snapshot = build({
    challenges: [upcoming],
    results: new Map([
      [
        challenge.id,
        {
          data: { ...results, challenge: upcoming, ranking_available: false },
          dataUpdatedAt: 1000,
        },
      ],
    ]),
  });
  expect(snapshot.items[0]).toMatchObject({
    lifecycle: 'upcoming',
    participantCount: 2,
    rows: [],
  });
});
it('passes reconciled completed values, including a downward correction', () => {
  const completed = { ...challenge, lifecycle: 'completed' as const };
  const corrected = {
    ...results,
    challenge: completed,
    entries: results.entries.map((r) => ({ ...r, total_score: 0 })),
  };
  expect(
    build({
      challenges: [completed],
      results: new Map([
        [challenge.id, { data: corrected, dataUpdatedAt: 1000 }],
      ]),
    }).items[0].rows.map((r) => r.total)
  ).toEqual([0, 0]);
});
it('preserves ties and server ranks rather than ranking the selected rows', () => {
  const tied = {
    ...results,
    lead_margin: 0,
    leader_user_ids: [actor, peer],
    entries: results.entries.map((r) => ({ ...r, rank: 1, is_tied: true })),
  };
  expect(
    build({
      results: new Map([[challenge.id, { data: tied, dataUpdatedAt: 1000 }]]),
    }).items[0].rows.every((r) => r.tied && r.leader && r.rank === 1)
  ).toBe(true);
});
it('includes top three plus self, preserving original rank seven', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    ...results.entries[0],
    user_id: i === 6 ? actor : `peer-${i}`,
    rank: i + 1,
  }));
  const item = build({
    results: new Map([
      [challenge.id, { data: { ...results, entries }, dataUpdatedAt: 1000 }],
    ]),
  }).items[0];
  expect(item.participantCount).toBe(10);
  expect(item.rows.map((r) => r.rank)).toEqual([1, 2, 3, 7]);
});
it('does not invent the current user when a malformed/wrong-account response omits them', () => {
  expect(build({ actor: 'someone-else' }).items[0].rows).toEqual([]);
});
it('uses oldest successful data time; repeated composition cannot freshen old data', () => {
  expect(build().generatedAt).toBe(1000);
  expect(build({ listUpdatedAt: 9000 }).generatedAt).toBe(1000);
});
it('suppresses access-denied cached responses while a transient error can retain them', () => {
  expect(
    build({
      results: new Map([
        [
          challenge.id,
          { data: results, dataUpdatedAt: 1000, inaccessible: true },
        ],
      ]),
    }).items
  ).toEqual([]);
  expect(build().items[0].rows).toHaveLength(2);
});
it('suppresses stale lifecycle results until refreshed', () => {
  expect(
    build({ challenges: [{ ...challenge, lifecycle: 'completed' }] }).items[0]
      .rows
  ).toEqual([]);
});
it('bounds, deduplicates and prioritizes loaded challenges deterministically', () => {
  const rows: ChallengeResponse[] = Array.from({ length: 20 }, (_, i) => ({
    ...challenge,
    id: `challenge-${String(i).padStart(2, '0')}`,
    lifecycle: i < 4 ? 'completed' : i < 8 ? 'upcoming' : 'active',
  }));
  rows.push({ ...challenge, id: 'invitation', my_membership: 'pending' });
  const selection = selectWatchChallenges([...rows, rows[0]]);
  expect(selection.items).toHaveLength(8);
  expect(selection.items[0].id).toBe('invitation');
  expect(selection.items[1].lifecycle).toBe('active');
  expect(selection.hasMore).toBe(true);
  expect(selectWatchChallenges([...rows].reverse())).toEqual(selection);
});
it('keeps at most two recent completed challenges and advertises additional pages', () => {
  expect(
    build({
      challenges: Array.from({ length: 4 }, (_, i) => ({
        ...challenge,
        id: String(i),
        lifecycle: 'completed',
      })),
    }).items
  ).toHaveLength(2);
  expect(build({ hasMore: true }).hasMore).toBe(true);
});
it('bounds worst-case UTF-8 payload and contains only property-list-safe values', () => {
  const challenges = Array.from({ length: 8 }, (_, i) => ({
    ...challenge,
    id: String(i),
    name: '🚶'.repeat(1000),
  }));
  const snapshot = build({
    challenges,
    results: new Map(
      challenges.map((c) => [
        c.id,
        {
          data: {
            ...results,
            challenge: c,
            entries: Array.from({ length: 100 }, (_, i) => ({
              ...results.entries[0],
              user_id: i === 99 ? actor : `user-${i}`,
              display_name: '🚶'.repeat(1000),
              rank: i + 1,
            })),
          },
          dataUpdatedAt: 1000,
        },
      ])
    ),
  });
  const check = (v: unknown): void => {
    expect(v).not.toBeNull();
    expect(v).not.toBeUndefined();
    if (typeof v === 'object') Object.values(v!).forEach(check);
    else expect(['string', 'number', 'boolean']).toContain(typeof v);
  };
  check(snapshot);
  expect(Buffer.byteLength(JSON.stringify(snapshot), 'utf8')).toBeLessThan(
    32_000
  );
});

it('shares the exact wire fixture with the native mapper tests', () => {
  expect(build()).toEqual(nativeFixture);
});
