import { useTranslation } from 'react-i18next';
import {
  formatChallengeDuration,
  type ChallengeResponse,
  type ChallengeLifecycle,
} from '@workspace/shared';

export function useChallengeFormat(
  metric: ChallengeResponse['metric'] = 'steps'
) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  // Formatting a DATE, not converting a business day into a different zone.
  const day = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
  const workout = metric === 'workout_time';
  const score = (value: number) =>
    workout ? formatChallengeDuration(value, locale) : number(value);
  const rules = workout
    ? t('challenges.workoutRules', {
        defaultValue: 'Workout time · Highest total wins',
      })
    : t('challenges.rules', { defaultValue: 'Steps · Highest total wins' });
  const noData = workout
    ? t('challenges.noWorkout', { defaultValue: 'No workout recorded' })
    : t('challenges.noData', { defaultValue: 'No step data' });
  const totalLabel = workout
    ? t('challenges.workoutTime', { defaultValue: 'Workout time' })
    : t('challenges.totalSteps', { defaultValue: 'total steps' });
  const coverageHint = workout
    ? t('challenges.workoutCoverageHint', {
        defaultValue:
          'No workout recorded does not mean all devices have synced. Ambiguous unfinished workouts are excluded; available data may still change.',
      })
    : t('challenges.coverageHint', {
        defaultValue:
          'Missing data counts as zero in the score, but does not mean no steps were taken. Available data may still change.',
      });
  const workoutCount = (count: number) =>
    t('challenges.workoutCount', {
      count,
      number: number(count),
      defaultValue: '{{number}} workouts',
      defaultValue_one: '{{number}} workout',
    });
  const leading = (name: string, value: number) =>
    workout
      ? t('challenges.workoutLeading', {
          defaultValue: '{{name}} leads by {{duration}}',
          name,
          duration: score(value),
        })
      : t('challenges.leading', {
          defaultValue: '{{name}} leads by {{steps}} steps',
          name,
          count: value,
          steps: number(value),
        });
  const behind = (value: number) =>
    workout
      ? t('challenges.workoutBehind', {
          defaultValue: '{{duration}} behind the lead',
          duration: score(value),
        })
      : t('challenges.behind', {
          defaultValue: '{{steps}} steps behind the lead',
          count: value,
          steps: number(value),
        });
  const coverage = (present: number, eligible: number) =>
    workout
      ? t('challenges.workoutCoverage', {
          defaultValue:
            '{{present}} of {{eligible}} elapsed days have recorded workouts',
          present: number(present),
          eligible: number(eligible),
        })
      : t('challenges.coverage', {
          defaultValue:
            '{{present}} of {{eligible}} elapsed days have step data',
          count: eligible,
          present: number(present),
          eligible: number(eligible),
        });
  const scoreWithUnit = (value: number) =>
    workout
      ? score(value)
      : t('challenges.stepsValue', {
          defaultValue: '{{steps}} steps',
          count: value,
          steps: number(value),
        });
  const solo = workout
    ? t('challenges.workoutStart', {
        defaultValue: 'Your next workout starts here',
      })
    : t('challenges.oneCompetitor', {
        defaultValue: 'Your next step starts here',
      });
  const statuses: Record<ChallengeLifecycle, string> = {
    active: t('challenges.active', 'Active'),
    upcoming: t('challenges.upcoming', 'Upcoming'),
    completed: t('challenges.completed', 'Completed'),
    cancelled: t('challenges.cancelled', 'Cancelled'),
  };
  return {
    t,
    number,
    day,
    statuses,
    locale,
    workout,
    score,
    rules,
    noData,
    totalLabel,
    coverageHint,
    workoutCount,
    leading,
    behind,
    coverage,
    scoreWithUnit,
    solo,
  };
}
