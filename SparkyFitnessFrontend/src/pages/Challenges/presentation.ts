import { useTranslation } from 'react-i18next';
import {
  formatChallengeDuration,
  formatChallengeValue,
  challengeScoreUnit,
  challengeTypeLabel,
  type ChallengeResponse,
  type ChallengeLifecycle,
} from '@workspace/shared';

export function useChallengeFormat(
  metric: ChallengeResponse['metric'] = 'steps',
  mode: ChallengeResponse['scoring_mode'] = 'sum'
) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  // Formatting a DATE, not converting a business day into a different zone.
  const day = (value: string | null) =>
    value === null
      ? t('challenges.waitingDates', {
          defaultValue: 'Dates set when everyone is Ready',
        })
      : new Intl.DateTimeFormat(locale, {
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
    lobby: t('challenges.lobby', { defaultValue: 'Waiting for players' }),
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
    ...(mode !== 'sum' || !['steps', 'workout_time'].includes(metric)
      ? {
          workout: metric.startsWith('workout_'),
          score: (value: number) =>
            formatChallengeValue(
              value,
              challengeScoreUnit(metric, mode),
              locale,
              false
            ),
          scoreWithUnit: (value: number) =>
            formatChallengeValue(
              value,
              challengeScoreUnit(metric, mode),
              locale
            ),
          totalLabel: t(
            `challenges.units.${challengeScoreUnit(metric, mode)}`,
            {
              defaultValue:
                challengeScoreUnit(metric, mode) === 'goal_days'
                  ? 'goal days'
                  : challengeScoreUnit(metric, mode),
            }
          ),
          rules: t(`challenges.typeLabels.${metric}.${mode}`, {
            defaultValue: challengeTypeLabel(metric, mode),
          }),
          noData: metric.startsWith('workout_')
            ? t('challenges.noWorkout', { defaultValue: 'No workout recorded' })
            : t('challenges.noMetricData', {
                defaultValue: 'No data recorded',
              }),
          coverageHint: t('challenges.metricCoverageHint', {
            defaultValue:
              'Missing data scores zero. It does not mean all devices have synced. Results can change when data is corrected.',
          }),
          leading: (name: string, value: number) =>
            t('challenges.metricLeading', {
              defaultValue: '{{name}} leads by {{value}}',
              name,
              value: formatChallengeValue(
                value,
                challengeScoreUnit(metric, mode),
                locale
              ),
            }),
          behind: (value: number) =>
            t('challenges.metricBehind', {
              defaultValue: '{{value}} behind the lead',
              value: formatChallengeValue(
                value,
                challengeScoreUnit(metric, mode),
                locale
              ),
            }),
          coverage: (present: number, eligible: number) =>
            t('challenges.metricCoverage', {
              defaultValue:
                '{{present}} of {{eligible}} elapsed days have data',
              present: number(present),
              eligible: number(eligible),
            }),
          solo: t('challenges.yourChallenge', {
            defaultValue: 'Your Challenge',
          }),
        }
      : {}),
  };
}
