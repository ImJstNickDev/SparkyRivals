import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import {
  formatChallengeDuration,
  type ChallengeResponse,
  type ChallengeLifecycle,
} from '@workspace/shared';
import { useAppLocale, formatLocalizedNumber } from '../../localization';
import { useNativeIOSHeadersActive } from '../../services/nativeTabBarPreference';
import { useActiveWorkoutBarPadding } from '../ActiveWorkoutBar';
import StatusView from '../StatusView';

export function useChallengeFormat(
  metric: ChallengeResponse['metric'] = 'steps'
) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const day = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
  const number = formatLocalizedNumber;
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
export function ChallengeFrame({
  header,
  children,
  refreshing = false,
  onRefresh,
  keyboard = false,
  footer,
}: {
  header: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const nativeHeader = useNativeIOSHeadersActive();
  const bar = useActiveWorkoutBarPadding('stack');
  const accent = useCSSVariable('--color-accent-primary') as string;
  const Container = keyboard ? KeyboardAwareScrollView : ScrollView;
  return (
    <View
      className="flex-1 bg-background"
      style={nativeHeader ? undefined : { paddingTop: insets.top }}
    >
      {header}
      <Container
        testID="challenge-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          paddingBottom: insets.bottom + 24 + bar,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accent}
            />
          ) : undefined
        }
      >
        {children}
      </Container>
      {footer}
    </View>
  );
}
export function ChallengeLoading() {
  const { t } = useTranslation();
  return (
    <StatusView
      inline
      loading
      title={t('challenges.loading', { defaultValue: 'Loading Challenges' })}
    />
  );
}
export function ChallengeProblem({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return (
    <StatusView
      inline
      icon="alert-circle"
      title={t('challenges.loadError', {
        defaultValue:
          'Could not load Challenges. Check your connection and try again.',
      })}
      action={{
        label: t('challenges.retry', { defaultValue: 'Try again' }),
        onPress: retry,
      }}
    />
  );
}
export function ChallengeMutationError() {
  const { t } = useTranslation();
  return (
    <Text accessibilityRole="alert" className="text-icon-danger text-sm">
      {t('challenges.actionError', {
        defaultValue:
          'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.',
      })}
    </Text>
  );
}
