import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  challengeTypeText,
  challengeDisplayQuantity,
  challengeDisplayUnitText,
  formatChallengeDisplay,
  challengeScoreUnit,
  type ChallengeResponse,
  type ChallengeLifecycle,
  type ChallengeScoreUnit,
} from '@workspace/shared';

export function useChallengeFormat(
  metric: ChallengeResponse['metric'] = 'steps',
  mode: ChallengeResponse['scoring_mode'] = 'sum'
) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const preferences = usePreferences();
  const displayPreferences = {
    distance: preferences.distanceUnit,
    energy: preferences.energyUnit,
    water: preferences.water_display_unit,
  };
  const value = (amount: number, unit: ChallengeScoreUnit, withUnit = true) =>
    formatChallengeDisplay(
      amount,
      unit,
      locale,
      t,
      displayPreferences,
      withUnit
    );
  const scoreUnit = challengeScoreUnit(metric, mode);
  const score = (amount: number) => value(amount, scoreUnit, false);
  const scoreWithUnit = (amount: number) => value(amount, scoreUnit);
  const unitLabel = (amount = 2) =>
    challengeDisplayUnitText(
      t,
      challengeDisplayQuantity(amount, scoreUnit, displayPreferences).unit,
      amount
    );
  const day = (date: string | null) =>
    date === null
      ? t('challenges.waitingDates', {
          defaultValue: 'Dates set when everyone is Ready',
        })
      : new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${date}T12:00:00Z`));
  const number = (amount: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  const statuses: Record<ChallengeLifecycle, string> = {
    lobby: t('challenges.lobby', { defaultValue: 'Waiting for players' }),
    active: t('challenges.active', { defaultValue: 'Active' }),
    upcoming: t('challenges.upcoming', { defaultValue: 'Upcoming' }),
    completed: t('challenges.completed', { defaultValue: 'Completed' }),
    cancelled: t('challenges.cancelled', { defaultValue: 'Cancelled' }),
  };
  return {
    t,
    locale,
    day,
    number,
    statuses,
    score,
    scoreWithUnit,
    value,
    unitLabel,
    displayPreferences,
    workout: metric.startsWith('workout_'),
    rules: challengeTypeText(t, metric, mode),
    noData: metric.startsWith('workout_')
      ? t('challenges.noWorkout', { defaultValue: 'No workout recorded' })
      : t('challenges.noMetricData', { defaultValue: 'No data recorded' }),
    totalLabel: unitLabel(),
    coverageHint: t('challenges.metricCoverageHint', {
      defaultValue:
        'Missing data scores zero. It does not mean all devices have synced. Results can change when data is corrected.',
    }),
    workoutCount: (count: number) =>
      t('challenges.workoutCount', {
        count,
        number: number(count),
        defaultValue: '{{number}} workouts',
        defaultValue_one: '{{number}} workout',
      }),
    leading: (name: string, amount: number) =>
      t('challenges.metricLeading', {
        defaultValue: '{{name}} leads by {{value}}',
        name,
        value: scoreWithUnit(amount),
      }),
    behind: (amount: number) =>
      t('challenges.metricBehind', {
        defaultValue: '{{value}} behind the lead',
        value: scoreWithUnit(amount),
      }),
    coverage: (present: number, eligible: number) =>
      t('challenges.metricCoverage', {
        defaultValue: '{{present}} of {{eligible}} elapsed days have data',
        present: number(present),
        eligible: number(eligible),
      }),
    solo: t('challenges.yourChallenge', { defaultValue: 'Your Challenge' }),
  };
}
