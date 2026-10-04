import {
  addDays,
  CHALLENGE_POINT_SCALE,
  CHALLENGE_METRIC_UNITS,
  challengeScoreUnit,
  type ChallengeDailyScore,
  type ChallengeLeaderboardEntry,
  type ChallengeLeaderboardResponse,
} from '@workspace/shared';
import {
  challengeDecimal,
  scoreChallengeDay,
  challengeScoreNumber,
} from '../utils/challengeScore.js';
import repository, {
  type ChallengeWithMembership,
  type ChallengeMetricPoint,
} from '../models/challengeRepository.js';
import { describeChallenge } from './challengeService.js';
import { ChallengeError } from '../utils/challengeErrors.js';

/** Pure scoring over the consent projection, never a second persisted health store. */
export function calculateChallengeLeaderboard(
  challengeRow: ChallengeWithMembership,
  points: ChallengeMetricPoint[],
  evaluatedAt: Date
): ChallengeLeaderboardResponse {
  const challenge = describeChallenge(challengeRow, evaluatedAt);
  const workout = challenge.metric.startsWith('workout_');
  const modern =
    challenge.scoring_mode !== 'sum' ||
    !['steps', 'workout_time'].includes(challenge.metric);
  const exactScores = new Map<string, bigint>();
  const cancelled = challenge.lifecycle === 'cancelled';
  const rankingAvailable =
    challenge.lifecycle === 'active' || challenge.lifecycle === 'completed';
  const through =
    cancelled ||
    challenge.lifecycle === 'upcoming' ||
    challenge.lifecycle === 'lobby' ||
    !challenge.end_date
      ? null
      : challenge.progress.today < challenge.end_date
        ? challenge.progress.today
        : challenge.end_date;
  const grouped = new Map<
    string,
    {
      name: string;
      target: string | number | null;
      points: Map<string, ChallengeMetricPoint>;
    }
  >();
  if (!cancelled)
    for (const point of points) {
      let member = grouped.get(point.user_id);
      if (!member) {
        member = {
          name: point.display_name,
          target: point.target_value ?? null,
          points: new Map(),
        };
        grouped.set(point.user_id, member);
      }
      if (
        point.entry_date &&
        point.value !== null &&
        through &&
        challenge.start_date &&
        point.entry_date >= challenge.start_date &&
        point.entry_date <= through
      )
        member.points.set(point.entry_date, point);
    }
  const entries: ChallengeLeaderboardEntry[] = [];
  for (const [userId, member] of grouped) {
    const daily: ChallengeDailyScore[] = [];
    let latest: Date | null = null;
    let exactTotal = 0n;
    const target =
      member.target === null || member.target === undefined
        ? null
        : challengeDecimal(member.target);
    for (
      let date = challenge.start_date;
      date && challenge.end_date && date <= challenge.end_date;
      date = addDays(date, 1)
    ) {
      const point = member.points.get(date);
      const eligible = through !== null && date <= through;
      const actual = challengeDecimal(point?.raw_value ?? point?.value ?? 0);
      const exact =
        modern && eligible
          ? scoreChallengeDay(
              actual,
              target,
              challenge.scoring_mode,
              point !== undefined
            )
          : actual;
      exactTotal += exact;
      daily.push({
        date,
        value: modern
          ? challengeScoreNumber(exact)
          : point
            ? (point.value ?? 0)
            : 0,
        ...(modern
          ? {
              actual_value: point?.value ?? 0,
              score_scaled: exact.toString(),
              ...(target && eligible
                ? {
                    progress_points: challengeScoreNumber(
                      scoreChallengeDay(
                        actual,
                        target,
                        'goal_progress',
                        point !== undefined
                      )
                    ),
                    goal_reached: point !== undefined && actual >= target,
                  }
                : {}),
            }
          : {}),
        ...(workout ? { workout_count: point?.workout_count ?? 0 } : {}),
        present: point !== undefined,
        eligible,
      });
      if (point?.data_updated_at && (!latest || point.data_updated_at > latest))
        latest = point.data_updated_at;
    }
    exactScores.set(userId, exactTotal);
    entries.push({
      user_id: userId,
      display_name: member.name,
      membership_status: 'accepted',
      total_score: modern
        ? challengeScoreNumber(exactTotal)
        : daily.reduce((sum, day) => sum + day.value, 0),
      ...(modern
        ? {
            total_score_scaled: exactTotal.toString(),
            total_actual_value: daily.reduce(
              (sum, day) => sum + (day.actual_value ?? 0),
              0
            ),
            target_value:
              member.target === null || member.target === undefined
                ? null
                : Number(member.target),
          }
        : {}),
      ...(workout
        ? {
            total_workout_count: daily.reduce(
              (sum, day) => sum + (day.workout_count ?? 0),
              0
            ),
          }
        : {}),
      rank: null,
      is_tied: false,
      gap_to_leader: null,
      gap_to_next_rank: null,
      daily,
      today:
        challenge.lifecycle === 'active'
          ? (daily.find((day) => day.date === challenge.progress.today) ?? null)
          : null,
      coverage: {
        days_with_data: member.points.size,
        ...(challenge.metric === 'steps'
          ? { days_with_steps: member.points.size }
          : {}),
        eligible_days: daily.filter((day) => day.eligible).length,
        latest_data_update_at: latest?.toISOString() ?? null,
      },
    });
  }
  // Stable UUID ordering never breaks a score tie into an artificial winner.
  const exactScore = (entry: ChallengeLeaderboardEntry) =>
    exactScores.get(entry.user_id) ?? 0n;
  entries.sort((a, b) =>
    exactScore(a) > exactScore(b)
      ? -1
      : exactScore(a) < exactScore(b)
        ? 1
        : a.user_id.localeCompare(b.user_id)
  );
  if (rankingAvailable) {
    for (let index = 0; index < entries.length;) {
      const start = index;
      const score = exactScore(entries[start]!);
      while (index < entries.length && exactScore(entries[index]!) === score)
        index++;
      const next = entries[index];
      for (let cursor = start; cursor < index; cursor++) {
        const entry = entries[cursor]!;
        entry.rank = start + 1;
        entry.is_tied = index - start > 1;
        entry.gap_to_leader = challengeScoreNumber(
          exactScore(entries[0]!) - score
        );
        entry.gap_to_next_rank = next
          ? challengeScoreNumber(score - exactScore(next))
          : null;
      }
    }
  }
  return {
    contract_version: modern ? 3 : workout ? 2 : 1,
    score_unit: challengeScoreUnit(challenge.metric, challenge.scoring_mode),
    ...(modern
      ? {
          canonical_unit: CHALLENGE_METRIC_UNITS[challenge.metric],
          score_scale: CHALLENGE_POINT_SCALE,
        }
      : {}),
    challenge,
    calculated_at: evaluatedAt.toISOString(),
    reconciles: true,
    scored_through: through,
    ranking_available: rankingAvailable,
    leader_user_ids: rankingAvailable
      ? entries.filter((e) => e.rank === 1).map((e) => e.user_id)
      : [],
    lead_margin:
      rankingAvailable && entries.length >= 2
        ? challengeScoreNumber(
            exactScore(entries[0]!) - exactScore(entries[1]!)
          )
        : null,
    entries,
  };
}
export async function getChallengeLeaderboard(
  actor: string,
  id: string
): Promise<ChallengeLeaderboardResponse> {
  const result = await repository.leaderboard(actor, id);
  if (!result) throw new ChallengeError(404, 'Challenge not found');
  if (result.challenge.my_membership !== 'accepted')
    throw new ChallengeError(403, 'Accept the invitation to view results');
  return calculateChallengeLeaderboard(
    result.challenge,
    result.points,
    result.evaluated_at
  );
}
