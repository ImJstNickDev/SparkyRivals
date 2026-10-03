import type {
  ChallengeLeaderboardResponse,
  ChallengeResponse,
} from '@workspace/shared';
import type {
  WatchChallengeItem,
  WatchChallengeSnapshot,
} from '../types/watchChallenges';

export const WATCH_CHALLENGE_LIMIT = 8;
const RECENT_COMPLETED_LIMIT = 2;
const clip = (value: string) => Array.from(value).slice(0, 100).join('');
export const emptyWatchChallenges = (): WatchChallengeSnapshot => ({
  version: 1,
  accountKey: '',
  state: 'unavailable',
  generatedAt: 0,
  items: [],
  hasMore: false,
});

/** Presentation selection only. Server lifecycle and order within a leaderboard
 * are never recomputed. Newest invitations first, earliest upcoming first. */
export function selectWatchChallenges(
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
        : c.lifecycle === 'upcoming'
          ? 2
          : 3;
  relevant.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.lifecycle === 'upcoming' && b.lifecycle === 'upcoming'
        ? a.start_date.localeCompare(b.start_date)
        : b.end_date.localeCompare(a.end_date)) ||
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
    .slice(0, WATCH_CHALLENGE_LIMIT);
  return { items, hasMore: relevant.length > items.length };
}

export interface WatchChallengeResult {
  data?: ChallengeLeaderboardResponse;
  dataUpdatedAt: number;
  /** Access denial must suppress cached data. Transient network failure doesn't. */
  inaccessible?: boolean;
}

export function buildWatchChallenges(input: {
  accountKey: string;
  actor: string;
  challenges: readonly ChallengeResponse[];
  listUpdatedAt: number;
  hasMore: boolean;
  results: ReadonlyMap<string, WatchChallengeResult>;
}): WatchChallengeSnapshot {
  if (!input.accountKey || !input.actor || !input.listUpdatedAt)
    return emptyWatchChallenges();
  const selection = selectWatchChallenges(input.challenges);
  let generatedAt = input.listUpdatedAt;
  const items: WatchChallengeItem[] = [];
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
      id: challenge.id,
      name: clip(metadata.name),
      lifecycle: challenge.lifecycle,
      membership: challenge.my_membership,
      startDate: metadata.start_date,
      endDate: metadata.end_date,
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
        ...(row.today ? { today: { ...row.today } } : {}),
        daysWithSteps: row.coverage.days_with_steps,
        eligibleDays: row.coverage.eligible_days,
      })),
    });
  }
  return {
    version: 1,
    accountKey: input.accountKey,
    state: 'ready',
    generatedAt,
    items,
    hasMore: input.hasMore || selection.hasMore,
  };
}
