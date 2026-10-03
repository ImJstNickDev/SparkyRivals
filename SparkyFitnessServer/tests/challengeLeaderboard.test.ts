import { describe, expect, it, vi, beforeEach } from 'vitest';
import { challengeLeaderboardResponseSchema } from '@workspace/shared';
import repository, {
  type ChallengeWithMembership,
  type ChallengeMetricPoint,
} from '../models/challengeRepository.js';
import {
  calculateChallengeLeaderboard as score,
  getChallengeLeaderboard,
} from '../services/challengeLeaderboardService.js';
vi.mock('../models/challengeRepository.js', () => ({
  default: { leaderboard: vi.fn() },
}));
const ids = [1, 2, 3, 4].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
);
const at = new Date('2026-03-30T10:00:00Z');
const challenge: ChallengeWithMembership = {
  id: '20000000-0000-4000-8000-000000000001',
  creator_user_id: ids[0]!,
  name: 'Steps',
  metric: 'steps',
  scoring_mode: 'sum',
  start_date: '2026-03-29',
  end_date: '2026-03-31',
  timezone: 'Europe/Rome',
  cancelled_at: null,
  created_at: at,
  updated_at: at,
  my_membership: 'accepted',
};
function point(
  index: number,
  date: string | null,
  steps: number | null
): ChallengeMetricPoint {
  return {
    user_id: ids[index]!,
    display_name: `Member ${index}`,
    entry_date: date,
    value: steps,
    data_updated_at: steps === null ? null : at,
  };
}
beforeEach(() => vi.clearAllMocks());
describe('canonical step scoring', () => {
  it('one participant, zero and missing days have explicit different coverage', () => {
    const r = score(challenge, [point(0, '2026-03-29', 0)], at);
    expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(true);
    expect(r.entries[0]).toMatchObject({
      rank: 1,
      total_score: 0,
      is_tied: false,
      coverage: { days_with_steps: 1, eligible_days: 2 },
      daily: [
        { date: '2026-03-29', value: 0, present: true, eligible: true },
        { date: '2026-03-30', value: 0, present: false, eligible: true },
        { date: '2026-03-31', value: 0, present: false, eligible: false },
      ],
    });
    expect(r.lead_margin).toBeNull();
    expect(r.scored_through).toBe('2026-03-30');
  });
  it('sums dates, ranks N participants, ties and deterministic identity ordering', () => {
    const r = score(
      challenge,
      [
        point(2, '2026-03-29', 200),
        point(0, '2026-03-29', 100),
        point(1, '2026-03-29', 100),
        point(0, '2026-03-30', 100),
        point(3, null, null),
      ],
      at
    );
    expect(
      r.entries.map((p) => [p.user_id, p.total_score, p.rank, p.is_tied])
    ).toEqual([
      [ids[0], 200, 1, true],
      [ids[2], 200, 1, true],
      [ids[1], 100, 3, false],
      [ids[3], 0, 4, false],
    ]);
    expect(r.leader_user_ids).toEqual([ids[0], ids[2]]);
    expect(r.lead_margin).toBe(0);
    expect(r.entries[0]?.gap_to_next_rank).toBe(100);
    expect(r.entries[2]?.gap_to_leader).toBe(100);
    expect(r.entries[0]?.today).toMatchObject({ value: 100, present: true });
  });
  it('two participants have a meaningful leader margin', () => {
    const r = score(
      challenge,
      [point(0, '2026-03-29', 300), point(1, '2026-03-29', 50)],
      at
    );
    expect(r.lead_margin).toBe(250);
    expect(r.entries[1]?.gap_to_leader).toBe(250);
  });
  it('missing days score zero without claiming a synced zero', () => {
    const r = score(
      challenge,
      [point(0, null, null), point(1, '2026-03-29', 0)],
      at
    );
    expect(r.entries.map((p) => p.rank)).toEqual([1, 1]);
    expect(r.entries[0]?.coverage.latest_data_update_at).toBeNull();
    expect(r.entries[1]?.coverage.latest_data_update_at).toBe(at.toISOString());
  });
  it('ignores pre-start, post-end and future values defensively', () => {
    const r = score(
      challenge,
      [
        point(0, '2026-03-28', 10000),
        point(0, '2026-03-31', 10000),
        point(0, '2026-04-01', 10000),
        point(0, '2026-03-29', 10),
      ],
      at
    );
    expect(r.entries[0]?.total_score).toBe(10);
  });
  it('upcoming challenges expose zero progress and no ranking', () => {
    const r = score(
      challenge,
      [point(0, '2026-03-29', 100)],
      new Date('2026-03-28T10:00:00Z')
    );
    expect(r).toMatchObject({
      ranking_available: false,
      leader_user_ids: [],
      lead_margin: null,
      scored_through: null,
    });
    expect(r.entries[0]).toMatchObject({
      rank: null,
      total_score: 0,
      today: null,
    });
  });
  it('end date is inclusive and completed results remain reconcilable', () => {
    const r = score(
      challenge,
      [point(0, '2026-03-31', 50)],
      new Date('2026-04-01T10:00:00Z')
    );
    expect(r.challenge.lifecycle).toBe('completed');
    expect(r.entries[0]?.total_score).toBe(50);
    expect(r.entries[0]?.today).toBeNull();
    expect(r.reconciles).toBe(true);
    expect(r.scored_through).toBe('2026-03-31');
  });
  it('cancellation suppresses all health projection and ranking', () => {
    expect(
      score(
        { ...challenge, cancelled_at: at },
        [point(0, '2026-03-29', 100)],
        at
      )
    ).toMatchObject({
      entries: [],
      ranking_available: false,
      leader_user_ids: [],
      scored_through: null,
    });
  });
  it('lower/cleared/deleted canonical inputs lower a historical result', () => {
    const completed = new Date('2026-04-02T00:00:00Z');
    const values = [1000, 100, 0, null].map(
      (value) =>
        score(
          challenge,
          [point(0, value === null ? null : '2026-03-29', value)],
          completed
        ).entries[0]!.total_score
    );
    expect(values).toEqual([1000, 100, 0, 0]);
  });
  it.each(['pending', 'declined', 'left'] as const)(
    'does not authorize %s scores',
    async (status) => {
      vi.mocked(repository.leaderboard).mockResolvedValue({
        challenge: { ...challenge, my_membership: status },
        points: [],
        evaluated_at: at,
      });
      await expect(
        getChallengeLeaderboard(ids[1]!, challenge.id)
      ).rejects.toMatchObject({ status: 403 });
    }
  );
  it('inaccessible and nonexistent result is 404', async () => {
    vi.mocked(repository.leaderboard).mockResolvedValue(null);
    await expect(
      getChallengeLeaderboard(ids[1]!, challenge.id)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('workout metric uses the common ranking engine', () => {
  const workout = { ...challenge, metric: 'workout_time' as const };
  const points = [
    { ...point(0, '2026-03-29', 1200), workout_count: 2 },
    { ...point(1, '2026-03-29', 1200), workout_count: 1 },
    { ...point(2, '2026-03-30', 600), workout_count: 1 },
  ];
  it('uses seconds and generic coverage; count never breaks ties', () => {
    const r = score(workout, points, at);
    expect(r).toMatchObject({
      contract_version: 2,
      score_unit: 'seconds',
      lead_margin: 0,
    });
    expect(r.entries.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(r.entries[2]?.gap_to_leader).toBe(600);
    expect(r.entries[0]?.coverage).toMatchObject({ days_with_data: 1 });
    expect(r.entries[0]?.coverage).not.toHaveProperty('days_with_steps');
    expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(true);
    expect(
      challengeLeaderboardResponseSchema.safeParse({
        ...r,
        score_unit: 'steps',
      }).success
    ).toBe(false);
    expect(
      challengeLeaderboardResponseSchema.safeParse({
        ...r,
        contract_version: 1,
      }).success
    ).toBe(false);
  });
  it.each([
    '2026-03-28T12:00:00Z',
    '2026-03-29T00:00:00Z',
    '2026-04-01T12:00:00Z',
  ])('uses calendar lifecycle and inclusive dates at %s', (timestamp) => {
    const r = score(workout, points, new Date(timestamp));
    expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(true);
    if (r.challenge.lifecycle === 'upcoming')
      expect(
        r.entries.every((e) => e.total_score === 0 && e.rank === null)
      ).toBe(true);
    else expect(r.entries[0]?.total_score).toBe(1200);
  });
  it('cancelled workout results reveal no rows', () =>
    expect(score({ ...workout, cancelled_at: at }, points, at).entries).toEqual(
      []
    ));
  it('accepts legacy steps responses without new additive fields', () => {
    const r = score(challenge, points, at);
    delete r.score_unit;
    for (const e of r.entries) delete e.coverage.days_with_data;
    expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(true);
  });
});
