import {
  challengeDayComparison,
  challengeDayState,
  CHALLENGE_METRIC_UNITS,
} from '@workspace/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type {
  ChallengeDailyScore,
  ChallengeLeaderboardResponse,
} from '@workspace/shared';
import Button from '../ui/Button';
import Icon from '../Icon';
import { useCSSVariable } from 'uniwind';
import BottomSheetPicker from '../BottomSheetPicker';
import { useChallengeFormat } from './ChallengeChrome';

export function ChallengeDailyHistory({
  result,
  actor,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
}) {
  const {
    t,
    number,
    day,
    noData,
    scoreWithUnit,
    workoutCount,
    value: formatValue,
  } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const [selected, setSelected] = useState(
    result.entries.find((e) => e.user_id === actor)?.user_id ??
      result.entries[0]?.user_id ??
      ''
  );
  const versus = result.entries.length === 2;
  const entries = versus
    ? result.entries
    : [
        result.entries.find((e) => e.user_id === selected) ?? result.entries[0],
      ].filter((e) => e !== undefined);
  const points = entries[0]?.daily ?? [];
  const [page, setPage] = useState(
    Math.max(0, Math.ceil(points.filter((p) => p.eligible).length / 7) - 1)
  );
  const current = Math.min(page, Math.max(0, Math.ceil(points.length / 7) - 1));
  const value = (p?: ChallengeDailyScore) =>
    !p?.eligible
      ? t('challenges.notStarted', { defaultValue: 'Not started' })
      : p.present
        ? scoreWithUnit(p.value)
        : noData;
  return (
    <View className="gap-4">
      <Text
        accessibilityRole="header"
        className="text-text-primary text-xl font-semibold"
      >
        {t('challenges.ux.dailyHistory', { defaultValue: 'Daily history' })}
      </Text>
      {!versus && (
        <BottomSheetPicker
          title={t('challenges.participant', { defaultValue: 'Participant' })}
          value={selected}
          options={result.entries.map((e) => ({
            label: e.display_name,
            value: e.user_id,
          }))}
          onSelect={setSelected}
        />
      )}
      {points.slice(current * 7, current * 7 + 7).map((point) => {
        const a = entries[0]?.daily.find((p) => p.date === point.date);
        const b = entries[1]?.daily.find((p) => p.date === point.date);
        const comparison = challengeDayComparison(a, b);
        return (
          <View
            key={point.date}
            className="gap-3 py-4 border-b border-border-subtle"
          >
            <Text className="text-text-primary font-semibold">
              {day(point.date)}
            </Text>
            {comparison && (
              <Text className="text-text-secondary text-sm">
                {comparison === 'tie'
                  ? t('challenges.dayTie', { defaultValue: 'Tied day' })
                  : t('challenges.dayAhead', {
                      defaultValue: '{{name}} ahead this day',
                      name: entries[comparison === 'first' ? 0 : 1]
                        ?.display_name,
                    })}
              </Text>
            )}
            {entries.map((entry) => {
              const p = entry.daily.find((d) => d.date === point.date);
              const state = challengeDayState(p);
              return (
                <View key={entry.user_id} className="gap-2">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="text-text-primary flex-shrink">
                      {entry.display_name}
                    </Text>
                    <View className="flex-shrink gap-1">
                      <Text className="text-text-primary font-medium">
                        {value(p)}
                      </Text>
                      {(state === 'reached' || state === 'notReached') && (
                        <View className="flex-row items-center gap-1">
                          <Icon
                            name={state === 'reached' ? 'checkmark' : 'remove'}
                            size={16}
                            color={secondary}
                          />
                          <Text className="text-text-secondary text-sm">
                            {state === 'reached'
                              ? t('challenges.ux.goalReached', {
                                  defaultValue: 'Goal reached',
                                })
                              : t('challenges.ux.goalNotReached', {
                                  defaultValue: 'Goal not reached',
                                })}
                          </Text>
                        </View>
                      )}
                      {p?.eligible &&
                        p.present &&
                        p.actual_value !== undefined &&
                        entry.target_value != null && (
                          <Text className="text-text-secondary text-sm">
                            {t('challenges.ux.actualTargetProgress', {
                              defaultValue:
                                '{{actual}} / {{target}} · {{percent}}%',
                              actual: formatValue(
                                p.actual_value,
                                CHALLENGE_METRIC_UNITS[result.challenge.metric],
                                false
                              ),
                              target: formatValue(
                                entry.target_value,
                                CHALLENGE_METRIC_UNITS[result.challenge.metric]
                              ),
                              percent: number(p.progress_points ?? 0),
                            })}
                          </Text>
                        )}
                      {p?.eligible &&
                        p.present &&
                        p.workout_count !== undefined && (
                          <Text className="text-text-secondary text-sm">
                            {workoutCount(p.workout_count)}
                          </Text>
                        )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      {points.length > 7 && (
        <View className="gap-3">
          <Text className="text-center text-text-secondary">
            {t('challenges.page', {
              defaultValue: '{{current}} / {{total}}',
              current: number(current + 1),
              total: number(Math.ceil(points.length / 7)),
            })}
          </Text>
          <View className="flex-row flex-wrap justify-between gap-2">
            <Button
              variant="secondary"
              disabled={current === 0}
              onPress={() => setPage(current - 1)}
            >
              {t('challenges.previousDays', { defaultValue: 'Earlier days' })}
            </Button>
            <Button
              variant="secondary"
              disabled={(current + 1) * 7 >= points.length}
              onPress={() => setPage(current + 1)}
            >
              {t('challenges.nextDays', { defaultValue: 'Later days' })}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

/** Secondary source/coverage facts, kept out of the primary competition view. */
export function ChallengeResultFacts({
  result,
}: {
  result: ChallengeLeaderboardResponse;
}) {
  const { t, value, workoutCount, coverage, coverageHint } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
  return (
    <View className="gap-4">
      {result.entries.map((entry) => (
        <View key={entry.user_id} className="gap-1">
          <Text className="text-text-primary font-semibold">
            {entry.display_name}
          </Text>
          {entry.target_value != null && (
            <Text className="text-text-secondary">
              {t('challenges.targetDisplay', {
                defaultValue: 'Daily target: {{target}}',
                target: value(
                  entry.target_value,
                  CHALLENGE_METRIC_UNITS[result.challenge.metric]
                ),
              })}
            </Text>
          )}
          {entry.total_workout_count !== undefined && (
            <Text className="text-text-secondary">
              {workoutCount(entry.total_workout_count)}
            </Text>
          )}
          <Text className="text-text-secondary text-sm">
            {coverage(
              entry.coverage.days_with_data ??
                entry.coverage.days_with_steps ??
                0,
              entry.coverage.eligible_days
            )}
          </Text>
        </View>
      ))}
      <Text className="text-text-secondary text-sm">{coverageHint}</Text>
    </View>
  );
}
