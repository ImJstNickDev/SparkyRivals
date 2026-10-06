import {
  challengeScoreUnit,
  type ChallengeDisplayPreferences,
  ChallengeLeaderboardResponse,
  ChallengeResponse,
} from '@workspace/shared';
import type {
  CompanionChallengeItem,
  CompanionChallengeSnapshot,
} from '../types/companionChallenges';

export const COMPANION_CHALLENGE_LIMIT = 8;
const RECENT_COMPLETED_LIMIT = 2;
const clip = (value: string) => Array.from(value).slice(0, 100).join('');
export const emptyCompanionChallenges = (): CompanionChallengeSnapshot => ({
  version: 1,
  accountKey: '',
  state: 'unavailable',
  generatedAt: 0,
  items: [],
  hasMore: false,
});

/** Presentation selection only. Server lifecycle and order within a leaderboard
 * are never recomputed. Newest invitations first, earliest upcoming first. */
export function selectCompanionChallenges(
  challenges: readonly ChallengeResponse[]
) {
  const relevant = [
    ...new Map(challenges.map((c) => [c.id, c])).values(),
  ].filter(
    (c) =>
      c.lifecycle !== 'cancelled' &&
      (c.my_membership === 'pending' || c.my_membership === 'accepted')
  );
  const priority = (c: ChallengeResponse) =>
    c.my_membership === 'pending'
      ? 0
      : c.lifecycle === 'active'
        ? 1
        : c.lifecycle === 'lobby'
          ? 2
          : c.lifecycle === 'upcoming'
            ? 3
            : 4;
  relevant.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.lifecycle === 'upcoming' && b.lifecycle === 'upcoming'
        ? (a.start_date ?? '').localeCompare(b.start_date ?? '')
        : (b.end_date ?? b.created_at).localeCompare(
            a.end_date ?? a.created_at
          )) ||
      a.id.localeCompare(b.id)
  );
  let completed = 0;
  const items = relevant
    .filter(
      (c) =>
        c.my_membership === 'pending' ||
        c.lifecycle !== 'completed' ||
        ++completed <= RECENT_COMPLETED_LIMIT
    )
    .slice(0, COMPANION_CHALLENGE_LIMIT);
  return { items, hasMore: relevant.length > items.length };
}

export interface CompanionChallengeResult {
  data?: ChallengeLeaderboardResponse;
  dataUpdatedAt: number;
  /** Access denial must suppress cached data. Transient network failure doesn't. */
  inaccessible?: boolean;
}

export function buildCompanionChallenges(input: {
  accountKey: string;
  actor: string;
  challenges: readonly ChallengeResponse[];
  listUpdatedAt: number;
  hasMore: boolean;
  displayPreferences?: ChallengeDisplayPreferences;
  results: ReadonlyMap<string, CompanionChallengeResult>;
}): CompanionChallengeSnapshot {
  if (!input.accountKey || !input.actor || !input.listUpdatedAt)
    return emptyCompanionChallenges();
  const selection = selectCompanionChallenges(input.challenges);
  let generatedAt = input.listUpdatedAt;
  const items: CompanionChallengeItem[] = [];
  for (const challenge of selection.items) {
    if (
      challenge.lifecycle === 'cancelled' ||
      (challenge.my_membership !== 'accepted' &&
        challenge.my_membership !== 'pending')
    )
      continue;
    const cached = input.results.get(challenge.id);
    if (cached?.inaccessible && challenge.my_membership === 'accepted')
      continue;
    // A refreshed list revoking consent/cancelling/changing lifecycle takes
    // precedence over an older cached result. Pending users never receive rows.
    const result =
      challenge.my_membership === 'accepted' &&
      cached?.data?.challenge.id === challenge.id &&
      cached.data.challenge.lifecycle === challenge.lifecycle &&
      cached.data.challenge.metric === challenge.metric &&
      cached.data.challenge.scoring_mode === challenge.scoring_mode &&
      cached.data.challenge.my_membership === 'accepted' &&
      cached.data.entries.some((row) => row.user_id === input.actor)
        ? cached.data
        : undefined;
    const metadata = result?.challenge ?? challenge;
    if (result && cached)
      generatedAt = Math.min(generatedAt, cached.dataUpdatedAt);
    const rows =
      result?.ranking_available && challenge.lifecycle !== 'upcoming'
        ? result.entries.filter(
            (row, index) => index < 3 || row.user_id === input.actor
          )
        : [];
    items.push({
      ...(metadata.scoring_mode !== 'sum' ||
      !['steps', 'workout_time'].includes(metadata.metric)
        ? {
            metric: metadata.metric,
            scoringMode: metadata.scoring_mode,
            scoreUnit: challengeScoreUnit(
              metadata.metric,
              metadata.scoring_mode
            ),
          }
        : metadata.metric === 'workout_time'
          ? { metric: 'workout_time' as const, scoreUnit: 'seconds' as const }
          : {}),
      ...(metadata.scoring_mode === 'sum' && input.displayPreferences
        ? ['distance', 'workout_distance'].includes(metadata.metric)
          ? {
              displayUnit:
                input.displayPreferences.distance === 'miles'
                  ? ('mi' as const)
                  : ('km' as const),
            }
          : ['active_calories', 'workout_calories'].includes(metadata.metric)
            ? {
                displayUnit:
                  input.displayPreferences.energy === 'kJ'
                    ? ('kJ' as const)
                    : ('kcal' as const),
              }
            : {}
        : {}),
      id: challenge.id,
      name: clip(metadata.name),
      lifecycle: challenge.lifecycle,
      membership: challenge.my_membership,
      ...(metadata.start_date ? { startDate: metadata.start_date } : {}),
      ...(metadata.end_date ? { endDate: metadata.end_date } : {}),
      timezone: metadata.timezone,
      totalDays: metadata.progress.total_days,
      daysRemaining: metadata.progress.days_remaining,
      ...(metadata.progress.current_day != null
        ? { currentDay: metadata.progress.current_day }
        : {}),
      ...(result
        ? {
            participantCount: result.entries.length,
            calculatedAt: result.calculated_at,
          }
        : {}),
      ...(result?.lead_margin != null
        ? { leadMargin: result.lead_margin }
        : {}),
      rows: rows.map((row) => ({
        id: row.user_id,
        name: clip(row.display_name),
        isSelf: row.user_id === input.actor,
        total: row.total_score,
        ...(row.rank != null ? { rank: row.rank } : {}),
        tied: row.is_tied,
        leader: result!.leader_user_ids.includes(row.user_id),
        ...(row.gap_to_leader != null
          ? { gapToLeader: row.gap_to_leader }
          : {}),
        ...(row.today
          ? {
              today: {
                date: row.today.date,
                value: row.today.value,
                present: row.today.present,
                eligible: row.today.eligible,
                ...(row.today.workout_count !== undefined
                  ? { workoutCount: row.today.workout_count }
                  : {}),
              },
            }
          : {}),
        ...(metadata.metric !== 'steps' || metadata.scoring_mode !== 'sum'
          ? {
              daysWithData: row.coverage.days_with_data ?? 0,
              ...(metadata.metric.startsWith('workout_')
                ? { workoutCount: row.total_workout_count ?? 0 }
                : {}),
            }
          : {
              daysWithSteps:
                row.coverage.days_with_data ??
                row.coverage.days_with_steps ??
                0,
            }),
        eligibleDays: row.coverage.eligible_days,
      })),
    });
  }
  return {
    version: items.some((item) => item.scoringMode !== undefined)
      ? 3
      : items.some((item) => item.metric === 'workout_time')
        ? 2
        : 1,
    accountKey: input.accountKey,
    state: 'ready',
    generatedAt,
    items,
    hasMore: input.hasMore || selection.hasMore,
  };
}
