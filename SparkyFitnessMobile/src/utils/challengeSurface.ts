import type { ChallengeDisplayPreferences } from '@workspace/shared';
import { challengeTypeText, formatChallengeDisplay } from '@workspace/shared';
import type { TFunction } from 'i18next';
import type {
  CompanionChallengeItem,
  CompanionChallengeSnapshot,
} from '../types/companionChallenges';
import { getChallengeSurfaceUrl } from './challengeSurfaceLinks';

/** One primary surface; presentation selection never changes ranks or lifecycle. */
export function selectPrimaryChallengeSurface(
  items: readonly CompanionChallengeItem[]
) {
  const priority = (c: CompanionChallengeItem) =>
    c.membership === 'accepted' && c.lifecycle === 'active'
      ? 0
      : c.membership === 'pending'
        ? 1
        : c.lifecycle === 'lobby'
          ? 2
          : c.lifecycle === 'upcoming'
            ? 3
            : 4;
  return [...items].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.lifecycle === 'upcoming' && b.lifecycle === 'upcoming'
        ? (a.startDate ?? '').localeCompare(b.startDate ?? '')
        : (b.endDate ?? '').localeCompare(a.endDate ?? '')) ||
      a.id.localeCompare(b.id)
  )[0];
}
function presentChallengeWidget(
  snapshot: CompanionChallengeSnapshot,
  item: CompanionChallengeItem | undefined,
  t: TFunction,
  locale: string,
  preferences: ChallengeDisplayPreferences
) {
  const title =
    item?.name ?? t('challenges.title', { defaultValue: 'Challenges' });
  const empty =
    snapshot.state === 'ready'
      ? t('challenges.surfaces.empty', {
          defaultValue: 'No Challenges. Create one in the app.',
        })
      : t('challenges.surfaces.notSynced', {
          defaultValue: 'Open the app to sync Challenges.',
        });
  const metric = item
    ? challengeTypeText(t, item?.metric ?? 'steps', item?.scoringMode ?? 'sum')
    : '';
  const score = (value: number) =>
    formatChallengeDisplay(
      value,
      item?.scoreUnit ??
        (item?.metric === 'workout_time' ? 'seconds' : 'steps'),
      locale,
      t,
      preferences,
      true,
      item?.scoreUnit === 'points' ? 1 : undefined
    );
  const own = item?.rows.find((r) => r.isSelf);
  const leader =
    item?.rows.find((r) => r.leader && !r.isSelf) ??
    item?.rows.find((r) => !r.isSelf);
  const canScore =
    item?.membership === 'accepted' &&
    ['active', 'completed'].includes(item.lifecycle) &&
    !!own;
  const gap = !canScore
    ? ''
    : own.leader
      ? item.leadMargin === 0
        ? t('challenges.surfaces.tied', { defaultValue: 'Tied for the lead' })
        : item.leadMargin !== undefined
          ? t('challenges.surfaces.ahead', {
              defaultValue: 'Ahead by {{value}}',
              value: score(item.leadMargin),
            })
          : ''
      : own.gapToLeader !== undefined
        ? t('challenges.surfaces.behind', {
            defaultValue: '{{value}} behind',
            value: score(own.gapToLeader),
          })
        : '';
  const status = !item
    ? empty
    : item.membership === 'pending'
      ? t('challenges.surfaces.invitation', {
          defaultValue: 'Invitation · Review in the app',
        })
      : item.lifecycle === 'lobby'
        ? t('challenges.surfaces.lobby', {
            defaultValue: 'Waiting for players · Review in the app',
          })
        : item.lifecycle === 'upcoming'
          ? t('challenges.surfaces.upcoming', {
              defaultValue: 'Starts {{date}}',
              date: new Intl.DateTimeFormat(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${item.startDate}T12:00:00Z`)),
            })
          : item.lifecycle === 'completed'
            ? t('challenges.surfaces.completed', {
                defaultValue: 'Completed · Reconciled results',
              })
            : t('challenges.surfaces.remaining', {
                defaultValue: '{{number}} days remaining',
                defaultValue_one: '{{number}} day remaining',
                count: item.daysRemaining ?? 0,
                number: new Intl.NumberFormat(locale).format(
                  item.daysRemaining ?? 0
                ),
              });
  const missing = item?.metric?.startsWith('workout_')
    ? t('challenges.noWorkout', { defaultValue: 'No workout recorded' })
    : item?.metric && item.metric !== 'steps'
      ? t('challenges.noMetricData', { defaultValue: 'No data recorded' })
      : t('challenges.noData', { defaultValue: 'No step data' });
  const present = (own?.daysWithData ?? own?.daysWithSteps ?? 0) > 0;
  return {
    version: 1,
    accountKey: snapshot.accountKey,
    generatedAt: snapshot.generatedAt,
    state: snapshot.state,
    id: item?.id ?? '',
    title,
    metric,
    status,
    score: canScore ? (present ? score(own.total) : missing) : '',
    rank:
      canScore && own.rank !== undefined
        ? t('challenges.surfaces.rank', {
            defaultValue: 'Rank {{rank}} of {{participants}}',
            rank: own.rank,
            participants: item.participantCount ?? item.rows.length,
          })
        : '',
    // Already bounded to the adjacent server rows by the widget projection.
    // Never sort by the rounded text or manufacture ranks for ties.
    neighbors: canScore
      ? item.rows
          .filter((row) => item.rowsAreAdjacent || row.isSelf)
          .map((row) => ({
            slot: row.isSelf
              ? 'self'
              : item.rows.indexOf(row) < item.rows.findIndex((r) => r.isSelf)
                ? 'above'
                : 'below',
            name: row.name,
            score:
              (row.daysWithData ?? row.daysWithSteps ?? 0) > 0
                ? score(row.total)
                : missing,
            rank:
              row.rank === undefined
                ? ''
                : new Intl.NumberFormat(locale).format(row.rank),
          }))
      : [],
    gap,
    peer:
      canScore && leader
        ? `${leader.name} · ${(leader.daysWithData ?? leader.daysWithSteps ?? 0) > 0 ? score(leader.total) : missing}`
        : '',
    url: item ? getChallengeSurfaceUrl(item.id, snapshot.accountKey) : '',
    staleLabel: t('challenges.surfaces.stale', {
      defaultValue: 'May be out of date',
    }),
  };
}

/** Backward-compatible automatic snapshot plus a bounded, account-scoped menu.
 * Choices reuse the companion queries; widgets never fetch health/results. */
export function buildChallengeWidget(
  snapshot: CompanionChallengeSnapshot,
  t: TFunction,
  locale: string,
  preferences: ChallengeDisplayPreferences = {}
) {
  const items =
    snapshot.state === 'ready' && snapshot.accountKey ? snapshot.items : [];
  const primary = presentChallengeWidget(
    snapshot,
    selectPrimaryChallengeSurface(items),
    t,
    locale,
    preferences
  );
  return {
    ...primary,
    choices: items
      .filter((item) => item.membership === 'accepted')
      .map((item) => ({
        ...presentChallengeWidget(snapshot, item, t, locale, preferences),
        selectionId: JSON.stringify([snapshot.accountKey, item.id]),
      })),
    hasMore: snapshot.hasMore,
  };
}
