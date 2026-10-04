import { describe, expect, it } from 'vitest';
import {
  createChallengeRequestSchema,
  challengeTargetSchema,
  CHALLENGE_TYPES,
  suggestedChallengeTarget,
} from '@workspace/shared';
import {
  challengeDecimal,
  scoreChallengeDay,
  challengeScoreNumber,
} from '../utils/challengeScore.js';
import { calculateChallengeLeaderboard } from '../services/challengeLeaderboardService.js';
import type {
  ChallengeWithMembership,
  ChallengeMetricPoint,
} from '../models/challengeRepository.js';
const owner = '00000000-0000-4000-8000-000000000001';
const peer = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-04T12:00:00Z');
const challenge: ChallengeWithMembership = {
  id: '00000000-0000-4000-8000-000000000003',
  creator_user_id: owner,
  name: 'Goal',
  metric: 'steps',
  scoring_mode: 'goal_progress',
  start_date: '2026-10-03',
  end_date: '2026-10-05',
  duration_days: 3,
  timezone: 'UTC',
  locked_at: now,
  cancelled_at: null,
  created_at: now,
  updated_at: now,
  my_membership: 'accepted',
};
function point(
  user_id: string,
  date: string,
  value: number,
  target_value: number
): ChallengeMetricPoint {
  return {
    user_id,
    display_name: 'Participant',
    entry_date: date,
    value,
    target_value,
    data_updated_at: now,
  };
}
describe('Challenge types and deterministic goal scoring', () => {
  it.each([
    [4000, 50],
    [8000, 100],
    [11200, 140],
    [16000, 200],
  ])('scores %i without a cap', (actual, expected) => {
    expect(
      challengeScoreNumber(
        scoreChallengeDay(
          challengeDecimal(actual),
          challengeDecimal(8000),
          'goal_progress',
          true
        )
      )
    ).toBe(expected);
  });
  it('keeps millionth-point precision and uses exact integer arithmetic for very small targets', () => {
    expect(
      scoreChallengeDay(
        challengeDecimal('1'),
        challengeDecimal('3'),
        'goal_progress',
        true
      )
    ).toBe(33333333n);
    expect(
      scoreChallengeDay(
        challengeDecimal('1000000000'),
        challengeDecimal('0.000001'),
        'goal_progress',
        true
      )
    ).toBe(100000000000000000000000n);
  });
  it.each([
    [7999, 0],
    [8000, 1],
    [16000, 1],
  ])('goal days for %i', (actual, expected) => {
    expect(
      challengeScoreNumber(
        scoreChallengeDay(
          challengeDecimal(actual),
          challengeDecimal(8000),
          'goal_days',
          true
        )
      )
    ).toBe(expected);
  });
  it('distinguishes missing from present zero, sums days, and never breaks a tie with raw values', () => {
    const result = calculateChallengeLeaderboard(
      challenge,
      [
        point(owner, '2026-10-03', 11200, 8000),
        point(owner, '2026-10-04', 4000, 8000),
        point(peer, '2026-10-03', 19000, 10000),
      ],
      now
    );
    expect(result.entries.map((e) => [e.rank, e.total_score])).toEqual([
      [1, 190],
      [1, 190],
    ]);
    expect(result.entries[0]?.total_score_scaled).toBe('190000000');
    expect(result.entries[1]?.daily[1]).toMatchObject({
      present: false,
      value: 0,
      eligible: true,
    });
    expect(result.entries[0]?.daily[2]).toMatchObject({
      present: false,
      value: 0,
      eligible: false,
    });
    const corrected = calculateChallengeLeaderboard(
      challenge,
      [
        point(owner, '2026-10-03', 12000, 8000),
        point(peer, '2026-10-03', 19000, 10000),
      ],
      now
    );
    expect(corrected.entries[0]?.user_id).toBe(peer);
  });
  it('returns a lobby without dates, eligible days, scores or ranks', () => {
    const result = calculateChallengeLeaderboard(
      { ...challenge, start_date: null, end_date: null, locked_at: null },
      [point(owner, '2026-10-04', 10000, 8000)],
      now
    );
    expect(result.challenge.lifecycle).toBe('lobby');
    expect(result.scored_through).toBeNull();
    expect(result.entries[0]).toMatchObject({
      daily: [],
      rank: null,
      total_score: 0,
    });
  });
  it.each(CHALLENGE_TYPES)(
    'accepts the $id type',
    ({ metric, scoring_mode }) => {
      expect(
        createChallengeRequestSchema.safeParse({
          name: 'Test',
          metric,
          scoring_mode,
          timezone: 'UTC',
          ...(scoring_mode === 'sum'
            ? { start_date: '2026-10-04', end_date: '2026-10-05' }
            : { duration_days: 2 }),
        }).success
      ).toBe(true);
    }
  );
  it.each([
    ['hydration', 'sum'],
    ['workout_distance', 'goal_progress'],
    ['workout_distance', 'goal_days'],
  ])('rejects %s / %s on the server contract', (metric, scoring_mode) => {
    expect(
      createChallengeRequestSchema.safeParse({
        name: 'Test',
        metric,
        scoring_mode,
        timezone: 'UTC',
        duration_days: 2,
      }).success
    ).toBe(false);
  });
  it('rejects provisional goal dates and missing duration', () => {
    expect(
      createChallengeRequestSchema.safeParse({
        name: 'Test',
        metric: 'steps',
        scoring_mode: 'goal_progress',
        timezone: 'UTC',
        start_date: '2026-10-04',
        end_date: '2026-10-05',
      }).success
    ).toBe(false);
  });
  it('allows small positive targets and rejects only precision/technical invalidity', () => {
    expect(challengeTargetSchema.safeParse(0.000001).success).toBe(true);
    for (const value of [0, -1, Infinity, NaN, 0.0000001, 1_000_000_001])
      expect(challengeTargetSchema.safeParse(value).success).toBe(false);
  });
  it('suggests only the matching personal goal and converts workout minutes to seconds', () => {
    expect(
      suggestedChallengeTarget('active_calories', { active_calories_goal: 500 })
    ).toBe(500);
    expect(
      suggestedChallengeTarget('workout_time', {
        target_exercise_duration_minutes: 45,
      })
    ).toBe(2700);
    expect(suggestedChallengeTarget('hydration', { water_goal_ml: 2000 })).toBe(
      2000
    );
    expect(suggestedChallengeTarget('steps', {})).toBeNull();
  });
});
