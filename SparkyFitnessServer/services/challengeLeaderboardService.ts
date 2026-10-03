import {
  addDays,
  type ChallengeDailyScore,
  type ChallengeLeaderboardEntry,
  type ChallengeLeaderboardResponse,
} from '@workspace/shared';
import repository, {
  type ChallengeWithMembership,
  type ChallengeStepPoint,
} from '../models/challengeRepository.js';
import { describeChallenge } from './challengeService.js';
import { ChallengeError } from '../utils/challengeErrors.js';

/** Pure scoring over the consent projection, never a second persisted health store. */
export function calculateChallengeLeaderboard(
  challengeRow: ChallengeWithMembership,
  points: ChallengeStepPoint[],
  evaluatedAt: Date
): ChallengeLeaderboardResponse {
  const challenge = describeChallenge(challengeRow, evaluatedAt);
  const cancelled = challenge.lifecycle === 'cancelled';
  const rankingAvailable =
    challenge.lifecycle === 'active' || challenge.lifecycle === 'completed';
  const through =
    cancelled || challenge.lifecycle === 'upcoming'
      ? null
      : challenge.progress.today < challenge.end_date
        ? challenge.progress.today
        : challenge.end_date;
  const grouped = new Map<
    string,
    { name: string; points: Map<string, ChallengeStepPoint> }
  >();
  if (!cancelled)
    for (const point of points) {
      let member = grouped.get(point.user_id);
      if (!member) {
        member = { name: point.display_name, points: new Map() };
        grouped.set(point.user_id, member);
      }
      if (
        point.entry_date &&
        point.steps !== null &&
        through &&
        point.entry_date >= challenge.start_date &&
        point.entry_date <= through
      )
        member.points.set(point.entry_date, point);
    }
  const entries: ChallengeLeaderboardEntry[] = [];
  for (const [userId, member] of grouped) {
    const daily: ChallengeDailyScore[] = [];
    let latest: Date | null = null;
    for (
      let date = challenge.start_date;
      date <= challenge.end_date;
      date = addDays(date, 1)
    ) {
      const point = member.points.get(date);
      const eligible = through !== null && date <= through;
      daily.push({
        date,
        value: point?.steps ?? 0,
        present: point !== undefined,
        eligible,
      });
      if (point?.data_updated_at && (!latest || point.data_updated_at > latest))
        latest = point.data_updated_at;
    }
    entries.push({
      user_id: userId,
      display_name: member.name,
      membership_status: 'accepted',
      total_score: daily.reduce((sum, day) => sum + day.value, 0),
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
        days_with_steps: member.points.size,
        eligible_days: daily.filter((day) => day.eligible).length,
        latest_data_update_at: latest?.toISOString() ?? null,
      },
    });
  }
  // Stable UUID ordering never breaks a score tie into an artificial winner.
  entries.sort(
    (a, b) =>
      b.total_score - a.total_score ||
      (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0)
  );
  if (rankingAvailable) {
    for (let index = 0; index < entries.length;) {
      const start = index;
      const score = entries[start]!.total_score;
      while (index < entries.length && entries[index]!.total_score === score)
        index++;
      const next = entries[index];
      for (let cursor = start; cursor < index; cursor++) {
        const entry = entries[cursor]!;
        entry.rank = start + 1;
        entry.is_tied = index - start > 1;
        entry.gap_to_leader = entries[0]!.total_score - score;
        entry.gap_to_next_rank = next ? score - next.total_score : null;
      }
    }
  }
  return {
    contract_version: 1,
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
        ? entries[0]!.total_score - entries[1]!.total_score
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
