import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CHALLENGE_METRIC_UNITS,
  type ChallengeLeaderboardResponse,
} from '@workspace/shared';
import { useChallengeFormat } from './ChallengeChrome';
import Icon from '../Icon';
import Button from '../ui/Button';
import { useCSSVariable } from 'uniwind';
import { challengeIcon } from './ChallengeCard';
import {
  challengePointPrecision,
  formatChallengePoints,
} from '@workspace/shared';

/** Server order/ranks are retained even when two presentation values round alike. */
export function ChallengeResultSummary({
  result,
  actor,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
}) {
  const {
    t,
    locale,
    score,
    scoreWithUnit,
    noData,
    number,
    value: formatValue,
    unitLabel,
  } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
  const [limit, setLimit] = useState(20);
  const [actuals, setActuals] = useState<Set<string>>(() => new Set());
  const accent = useCSSVariable('--color-accent-primary') as string;
  const pointMode = result.challenge.scoring_mode === 'goal_progress';
  const precision = challengePointPrecision(result.entries, result.score_scale);
  const points = (entry: (typeof result.entries)[number]) =>
    pointMode
      ? formatChallengePoints(
          entry,
          precision.get(entry.user_id) ?? 0,
          locale,
          result.score_scale
        )
      : score(entry.total_score);
  const own = result.entries.find((entry) => entry.user_id === actor);
  const place =
    own?.rank != null
      ? t('challenges.ux.place', {
          count: own.rank,
          ordinal: true,
          number: number(own.rank),
          defaultValue: '{{number}}th place',
          defaultValue_ordinal_one: '{{number}}st place',
          defaultValue_ordinal_two: '{{number}}nd place',
          defaultValue_ordinal_few: '{{number}}rd place',
          defaultValue_ordinal_other: '{{number}}th place',
        })
      : null;
  const position = own?.is_tied
    ? t('challenges.ux.tiedPlace', {
        defaultValue: 'Joint {{place}}',
        place,
      })
    : place;
  const today = own?.today;
  const progress =
    today?.eligible && today.present ? today.progress_points : undefined;
  const numberCompact = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const goal = result.challenge.scoring_mode !== 'sum';
  const Row = goal ? Pressable : View;
  return (
    <View className="gap-6">
      {own && (
        <View className="gap-5">
          <View
            testID="challenge-own-result"
            className="gap-2 rounded-2xl bg-surface p-5"
          >
            <Text className="text-text-secondary">
              {t('challenges.ux.yourTotal', { defaultValue: 'Your total' })}
            </Text>
            <View className="flex-row flex-wrap items-baseline gap-x-2">
              <Text
                className="text-text-primary text-5xl font-bold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {points(own)}
              </Text>
              <Text className="text-text-secondary text-lg">
                {unitLabel(own.total_score)}
              </Text>
            </View>
            {own.rank !== null && (
              <Text className="text-accent-primary font-semibold">
                {t('challenges.ux.placeAndPlayers', {
                  defaultValue: '{{place}} · {{number}} players',
                  defaultValue_one: '{{place}} · {{number}} player',
                  place: position,
                  number: number(result.entries.length),
                  count: result.entries.length,
                })}
              </Text>
            )}
          </View>
          {today && (
            <View className="gap-2">
              <Text className="text-text-primary">
                {progress !== undefined
                  ? t('challenges.ux.todayPercent', {
                      defaultValue: 'Today {{percent}}%',
                      percent: numberCompact(progress),
                    })
                  : t('challenges.todayValue', {
                      defaultValue: 'Today: {{value}}',
                      value:
                        today.eligible && today.present
                          ? scoreWithUnit(today.value)
                          : noData,
                    })}
              </Text>
              {goal &&
                today.present &&
                today.actual_value !== undefined &&
                own.target_value != null && (
                  <>
                    <Text className="text-text-secondary">
                      {t('challenges.ux.actualTarget', {
                        defaultValue: '{{actual}} / {{target}}',
                        actual: formatValue(
                          today.actual_value,
                          CHALLENGE_METRIC_UNITS[result.challenge.metric],
                          false
                        ),
                        target: formatValue(
                          own.target_value,
                          CHALLENGE_METRIC_UNITS[result.challenge.metric]
                        ),
                      })}
                    </Text>
                    {progress !== undefined && (
                      <View
                        accessible
                        accessibilityLabel={t('challenges.ux.goalPercent', {
                          defaultValue: '{{percent}}% of your daily target',
                          percent: numberCompact(progress),
                        })}
                        className="gap-1"
                      >
                        <View className="h-2 bg-raised rounded-full overflow-hidden">
                          <View
                            className="h-2 bg-accent-primary rounded-full"
                            style={{
                              width: `${Math.min(100, (Math.max(0, progress) / Math.max(100, progress)) * 100)}%`,
                            }}
                          />
                          <View
                            className="absolute top-0 h-2 w-0.5 bg-text-primary"
                            style={{
                              left: `${Math.min(99, (100 / Math.max(100, progress)) * 100)}%`,
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </>
                )}
            </View>
          )}
        </View>
      )}
      <View>
        <Text
          accessibilityRole="header"
          className="text-text-primary text-lg font-semibold mb-2"
        >
          {t('challenges.ux.standings', { defaultValue: 'Standings' })}
        </Text>
        {result.entries.slice(0, limit).map((entry) => {
          const actual = goal && actuals.has(entry.user_id);
          const value = actual
            ? formatValue(
                entry.total_actual_value ?? entry.total_score,
                CHALLENGE_METRIC_UNITS[result.challenge.metric]
              )
            : goal
              ? points(entry)
              : scoreWithUnit(entry.total_score);
          const hint = actual
            ? t('challenges.ux.showPoints', { defaultValue: 'Show score' })
            : t('challenges.ux.showActual', {
                defaultValue: 'Show accumulated activity',
              });
          return (
            <Row
              key={entry.user_id}
              accessible
              accessibilityRole={goal ? 'button' : 'text'}
              accessibilityLabel={t('challenges.ux.standingValue', {
                defaultValue: '{{name}}, rank {{rank}}, {{value}}',
                name: entry.display_name,
                rank: entry.rank ?? '—',
                value:
                  !goal || actual
                    ? value
                    : t('challenges.valueWithUnit', {
                        defaultValue: '{{value}} {{unit}}',
                        value,
                        unit: unitLabel(entry.total_score),
                      }),
              })}
              accessibilityHint={goal ? hint : undefined}
              onPress={
                !goal
                  ? undefined
                  : () =>
                      setActuals((previous) => {
                        const next = new Set(previous);
                        if (next.has(entry.user_id)) next.delete(entry.user_id);
                        else next.add(entry.user_id);
                        return next;
                      })
              }
              className="flex-row items-center gap-3 py-4 border-b border-border-subtle min-h-12"
            >
              <Text className="text-text-secondary w-7">
                {entry.rank === null ? '—' : number(entry.rank)}
              </Text>
              <View className="flex-1 gap-1">
                <Text className="text-text-primary font-semibold">
                  {entry.display_name}
                  {entry.user_id === actor
                    ? ` ${t('challenges.you', { defaultValue: '(you)' })}`
                    : ''}
                </Text>
                {entry.is_tied && (
                  <Text className="text-text-secondary text-sm">
                    {t('challenges.tied', { defaultValue: 'Tied' })}
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-1 flex-shrink">
                <Icon
                  name={
                    actual || !goal
                      ? challengeIcon[result.challenge.metric]
                      : 'trophy'
                  }
                  size={18}
                  color={accent}
                />
                <Text
                  className="text-text-primary font-semibold flex-shrink"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {value}
                </Text>
              </View>
            </Row>
          );
        })}
        {result.entries.length > limit && (
          <Button variant="ghost" onPress={() => setLimit(limit + 20)}>
            {t('challenges.moreParticipants', {
              defaultValue: 'Show more participants',
            })}
          </Button>
        )}
      </View>
    </View>
  );
}
