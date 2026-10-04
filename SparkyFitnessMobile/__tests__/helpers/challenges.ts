import type {
  ChallengeResponse,
  ChallengeDetailResponse,
  ChallengeLeaderboardResponse,
  ChallengeConnection,
} from '@workspace/shared';
export const actor = '11111111-1111-4111-8111-111111111111';
export const peer = '22222222-2222-4222-8222-222222222222';
export const third = '33333333-3333-4333-8333-333333333333';
export const challenge: ChallengeResponse = {
  id: '44444444-4444-4444-8444-444444444444',
  creator_user_id: actor,
  name: 'A little further',
  metric: 'steps',
  scoring_mode: 'sum',
  start_date: '2026-10-03',
  end_date: '2026-10-09',
  timezone: 'Europe/Rome',
  cancelled_at: null,
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  lifecycle: 'active',
  my_membership: 'accepted',
  progress: {
    today: '2026-10-04',
    total_days: 7,
    elapsed_days: 1,
    days_remaining: 6,
    current_day: 2,
  },
};
export const detail: ChallengeDetailResponse = {
  challenge,
  participants: [actor, peer].map((id, index) => ({
    challenge_id: challenge.id,
    user_id: id,
    invited_by_user_id: actor,
    status: 'accepted',
    invited_at: '2026-10-02T10:00:00Z',
    accepted_at: '2026-10-02T10:00:00Z',
    declined_at: null,
    left_at: null,
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    display_name: index ? 'Marta' : 'Nico',
  })),
};
export const results: ChallengeLeaderboardResponse = {
  contract_version: 1,
  challenge,
  calculated_at: '2026-10-04T12:00:00Z',
  reconciles: true,
  scored_through: '2026-10-04',
  ranking_available: true,
  leader_user_ids: [actor],
  lead_margin: 2287,
  entries: detail.participants.map((p, index) => ({
    user_id: p.user_id,
    display_name: p.display_name,
    membership_status: 'accepted',
    total_score: index ? 51993 : 54280,
    rank: index + 1,
    is_tied: false,
    gap_to_leader: index ? 2287 : 0,
    gap_to_next_rank: index ? null : 2287,
    daily: [
      {
        date: '2026-10-03',
        value: index ? 51993 : 54280,
        present: true,
        eligible: true,
      },
      { date: '2026-10-04', value: 0, present: !index, eligible: true },
      { date: '2026-10-05', value: 0, present: false, eligible: false },
    ],
    today: { date: '2026-10-04', value: 0, present: !index, eligible: true },
    coverage: {
      days_with_steps: index ? 1 : 2,
      eligible_days: 2,
      latest_data_update_at: '2026-10-04T10:00:00Z',
    },
  })),
};
export const connection: ChallengeConnection = {
  owner_user_id: actor,
  family_user_id: peer,
  owner_full_name: 'Nico',
  family_full_name: 'Marta',
  is_active: true,
  status: 'active',
  access_start_date: '2026-01-01T00:00:00Z',
  access_end_date: null,
};

export const workoutResults: ChallengeLeaderboardResponse = {
  ...results,
  contract_version: 2,
  score_unit: 'seconds',
  challenge: { ...challenge, metric: 'workout_time' },
  lead_margin: 1440,
  entries: results.entries.map((entry, index) => ({
    ...entry,
    total_score: index ? 11880 : 13320,
    total_workout_count: index ? 3 : 4,
    gap_to_leader: index ? 1440 : 0,
    gap_to_next_rank: index ? null : 1440,
    daily: entry.daily.map((day, dayIndex) => ({
      ...day,
      value: dayIndex === 0 ? (index ? 11880 : 13320) : 0,
      workout_count: dayIndex === 0 ? 3 : day.present ? 1 : 0,
    })),
    today: { ...entry.today!, workout_count: index ? 0 : 1 },
    coverage: {
      days_with_data: index ? 1 : 2,
      eligible_days: 2,
      latest_data_update_at: '2026-10-04T10:00:00Z',
    },
  })),
};

/** Modern contract fixture: server-authoritative fixed-point points, no raw-value tie-break. */
export const goalResults: ChallengeLeaderboardResponse = {
  ...results,
  contract_version: 3,
  score_unit: 'points',
  canonical_unit: 'steps',
  score_scale: 1_000_000,
  challenge: {
    ...challenge,
    scoring_mode: 'goal_progress',
    duration_days: 7,
    start_next_day: false,
    locked_at: '2026-10-03T00:00:00Z',
  },
  entries: results.entries.map((entry, index) => ({
    ...entry,
    target_value: index ? 16000 : 8000,
    total_score: 140,
    total_score_scaled: '140000000',
    total_actual_value: index ? 22400 : 11200,
    rank: 1,
    is_tied: true,
    gap_to_leader: 0,
    gap_to_next_rank: null,
    daily: entry.daily.map((day) => ({
      ...day,
      value: day.present ? 140 : 0,
      actual_value: day.present ? (index ? 22400 : 11200) : 0,
      score_scaled: day.present ? '140000000' : '0',
      progress_points: day.present ? 140 : 0,
      goal_reached: day.present,
    })),
    today: {
      ...entry.daily[0]!,
      value: 140,
      actual_value: index ? 22400 : 11200,
      score_scaled: '140000000',
      progress_points: 140,
      goal_reached: true,
    },
    coverage: { ...entry.coverage, days_with_data: 1 },
  })),
  leader_user_ids: [actor, peer],
  lead_margin: 0,
};
