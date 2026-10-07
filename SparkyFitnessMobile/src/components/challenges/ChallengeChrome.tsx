import {
  challengeReadIssue,
  challengeTypeText,
  formatChallengeDisplay,
  challengeDisplayUnitText,
} from '@workspace/shared';
import { usePreferences } from '../../hooks/usePreferences';
import type { ReactNode } from 'react';
import {
  FlatList,
  type ListRenderItem,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useCSSVariable } from 'uniwind';
import {
  challengeDisplayQuantity,
  type ChallengeScoreUnit,
  challengeScoreUnit,
  type ChallengeResponse,
  type ChallengeLifecycle,
} from '@workspace/shared';
import { useAppLocale } from '../../localization';
import { useNativeIOSHeadersActive } from '../../services/nativeTabBarPreference';
import { useActiveWorkoutBarPadding } from '../ActiveWorkoutBar';
import StatusView from '../StatusView';

export function useChallengeFormat(
  metric: ChallengeResponse['metric'] = 'steps',
  mode: ChallengeResponse['scoring_mode'] = 'sum'
) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { preferences } = usePreferences();
  const displayPreferences = {
    distance: preferences?.default_distance_unit,
    energy: preferences?.energy_unit,
    water: preferences?.water_display_unit,
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
export function ChallengeFrame({
  header,
  children,
  refreshing = false,
  onRefresh,
  keyboard = false,
  footer,
  list,
}: {
  header: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  footer?: ReactNode;
  list?: {
    key: string;
    data: ChallengeResponse[];
    renderItem: ListRenderItem<ChallengeResponse>;
    footer?: ReactNode;
  };
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
      {list ? (
        <FlatList
          testID="challenge-list"
          className="flex-1"
          key={list.key}
          data={list.data}
          renderItem={list.renderItem}
          keyExtractor={(item) => item.id}
          initialNumToRender={12}
          windowSize={5}
          ListHeaderComponent={<View className="gap-5 pb-4">{children}</View>}
          ListFooterComponent={<View className="py-4">{list.footer}</View>}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 24 + bar,
          }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <Container
          testID="challenge-scroll"
          style={{ flex: 1 }}
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
      )}
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
export function ChallengeProblem({
  retry,
  error,
}: {
  retry: () => void;
  error?: unknown;
}) {
  const { t } = useTranslation();
  return (
    <StatusView
      inline
      icon="alert-circle"
      title={
        challengeReadIssue(error) === 'unavailable'
          ? t('challenges.ux.unavailable', {
              defaultValue: 'This Challenge is no longer available.',
            })
          : challengeReadIssue(error) === 'unsupported'
            ? t('challenges.ux.unsupported', {
                defaultValue: 'Update the app or server to use this Challenge.',
              })
            : t('challenges.loadError', {
                defaultValue:
                  'Could not load Challenges. Check your connection and try again.',
              })
      }
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
