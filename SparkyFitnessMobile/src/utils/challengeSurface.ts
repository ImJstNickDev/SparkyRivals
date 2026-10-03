import { formatChallengeDuration } from '@workspace/shared';
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
        : c.lifecycle === 'upcoming'
          ? 2
          : 3;
  return [...items].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.lifecycle === 'upcoming' && b.lifecycle === 'upcoming'
        ? a.startDate.localeCompare(b.startDate)
        : b.endDate.localeCompare(a.endDate)) ||
      a.id.localeCompare(b.id)
  )[0];
}
export function buildChallengeWidget(
  snapshot: CompanionChallengeSnapshot,
  t: TFunction,
  locale: string
) {
  const item =
    snapshot.state === 'ready'
      ? selectPrimaryChallengeSurface(snapshot.items)
      : undefined;
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
  const metric =
    item?.metric === 'workout_time'
      ? t('challenges.workoutTime', { defaultValue: 'Workout time' })
      : t('challenges.stepsMetric', { defaultValue: 'Steps' });
  const score = (value: number) =>
    item?.metric === 'workout_time'
      ? formatChallengeDuration(value, locale)
      : t('challenges.surfaces.steps', {
          defaultValue: '{{value}} steps',
          value: new Intl.NumberFormat(locale).format(value),
        });
  const own = item?.rows.find((r) => r.isSelf);
  const leader =
    item?.rows.find((r) => r.leader && !r.isSelf) ??
    item?.rows.find((r) => !r.isSelf);
  const canScore =
    item?.membership === 'accepted' && item.lifecycle !== 'upcoming' && !!own;
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
  const missing =
    item?.metric === 'workout_time'
      ? t('challenges.noWorkout', { defaultValue: 'No workout recorded' })
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
    score: canScore
      ? present
        ? score(own.total)
        : item.metric === 'workout_time'
          ? t('challenges.noWorkout', {
              defaultValue: 'No workout recorded',
            })
          : t('challenges.noData', { defaultValue: 'No step data' })
      : '',
    rank:
      canScore && own.rank !== undefined
        ? t('challenges.surfaces.rank', {
            defaultValue: 'Rank {{rank}} of {{participants}}',
            rank: own.rank,
            participants: item.participantCount ?? item.rows.length,
          })
        : '',
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
