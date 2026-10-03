import { useState } from 'react';
import { Text, View } from 'react-native';
import type {
  ChallengeDailyScore,
  ChallengeLeaderboardResponse,
} from '@workspace/shared';
import Button from '../ui/Button';
import BottomSheetPicker from '../BottomSheetPicker';
import { useChallengeFormat } from './ChallengeChrome';

export function ChallengeScores({
  result,
  actor,
  compact = false,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
  compact?: boolean;
}) {
  const { t, number } = useChallengeFormat();
  const [limit, setLimit] = useState(20);
  const entries = result.entries.slice(0, compact ? 3 : limit);
  const leaders = result.entries.filter((e) =>
    result.leader_user_ids.includes(e.user_id)
  );
  const names = leaders.map((e) => e.display_name).join(', ');
  const versus = result.entries.length === 2;
  const maximum = Math.max(1, result.entries[0]?.total_score ?? 0);
  return (
    <View className="gap-4">
      {result.ranking_available && leaders.length > 0 && (
        <Text
          accessibilityRole="header"
          className="text-text-primary text-xl font-semibold"
        >
          {leaders.length > 1
            ? t('challenges.tiedLead', {
                defaultValue: '{{names}} share the lead',
                names,
              })
            : result.lead_margin !== null
              ? t('challenges.leading', {
                  defaultValue: '{{name}} leads by {{steps}} steps',
                  name: names,
                  count: result.lead_margin,
                  steps: number(result.lead_margin),
                })
              : t('challenges.oneCompetitor', {
                  defaultValue: 'Your next step starts here',
                })}
        </Text>
      )}
      {entries.map((entry) => (
        <View
          key={entry.user_id}
          className={`gap-3 rounded-2xl border p-5 ${entry.rank === 1 ? 'border-accent-primary bg-surface' : 'border-border-subtle bg-surface'}`}
        >
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-text-primary text-lg font-semibold flex-shrink">
              {entry.display_name}
              {entry.user_id === actor
                ? ` ${t('challenges.you', { defaultValue: '(you)' })}`
                : ''}
            </Text>
            <Text className="text-text-secondary text-sm">
              {entry.rank === null
                ? t('challenges.notRanked', { defaultValue: 'Not ranked yet' })
                : t('challenges.rank', {
                    defaultValue: 'Rank {{rank}}',
                    rank: number(entry.rank),
                  })}
              {entry.is_tied
                ? ` · ${t('challenges.tied', { defaultValue: 'Tied' })}`
                : ''}
            </Text>
          </View>
          <View>
            <Text
              className={`text-text-primary font-bold ${versus ? 'text-4xl' : 'text-3xl'}`}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {number(entry.total_score)}
            </Text>
            <Text className="text-text-secondary text-sm mt-1">
              {t('challenges.totalSteps', { defaultValue: 'total steps' })}
            </Text>
          </View>
          <View
            accessible={false}
            className="h-2 rounded-full bg-raised overflow-hidden"
          >
            <View
              className="h-full rounded-full bg-accent-primary"
              style={{
                width: `${(Math.max(0, entry.total_score) / maximum) * 100}%`,
              }}
            />
          </View>
          {entry.today && (
            <Text className="text-text-primary text-sm">
              {t('challenges.todayValue', {
                defaultValue: 'Today: {{value}}',
                value: entry.today.present
                  ? number(entry.today.value)
                  : t('challenges.noData', { defaultValue: 'No step data' }),
              })}
            </Text>
          )}
          {!compact && (
            <>
              <Text className="text-text-secondary text-sm">
                {t('challenges.coverage', {
                  defaultValue:
                    '{{present}} of {{eligible}} elapsed days have step data',
                  count: entry.coverage.eligible_days,
                  present: number(entry.coverage.days_with_steps),
                  eligible: number(entry.coverage.eligible_days),
                })}
              </Text>
              {entry.gap_to_leader !== null && entry.gap_to_leader > 0 && (
                <Text className="text-text-primary text-sm">
                  {t('challenges.behind', {
                    defaultValue: '{{steps}} steps behind the lead',
                    count: entry.gap_to_leader,
                    steps: number(entry.gap_to_leader),
                  })}
                </Text>
              )}
            </>
          )}
        </View>
      ))}
      {!compact && result.entries.length > limit && (
        <Button
          variant="secondary"
          onPress={() => setLimit(limit + 20)}
          accessibilityLabel={t('challenges.moreParticipants', {
            defaultValue: 'Show more participants',
          })}
        >
          {t('challenges.moreParticipants', {
            defaultValue: 'Show more participants',
          })}
        </Button>
      )}
      {compact && result.entries.length > 3 && (
        <Text className="text-text-secondary text-sm">
          {t('challenges.moreCompetitors', {
            defaultValue: '{{number}} participants in this Challenge',
            number: number(result.entries.length),
          })}
        </Text>
      )}
      {!compact && (
        <Text className="text-text-secondary text-sm">
          {t('challenges.coverageHint', {
            defaultValue:
              'Missing data counts as zero in the score, but does not mean no steps were taken. Available data may still change.',
          })}
        </Text>
      )}
    </View>
  );
}

export function ChallengeDailyHistory({
  result,
  actor,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
}) {
  const { t, number, day } = useChallengeFormat();
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
        ? t('challenges.stepsValue', {
            defaultValue: '{{steps}} steps',
            count: p.value,
            steps: number(p.value),
          })
        : t('challenges.noData', { defaultValue: 'No step data' });
  return (
    <View className="rounded-3xl bg-surface border border-border-subtle p-5 gap-4">
      <Text
        accessibilityRole="header"
        className="text-text-primary text-xl font-semibold"
      >
        {t('challenges.dailyHistory', { defaultValue: 'Every day counts' })}
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
        const comparable = a?.eligible && b?.eligible && a.present && b.present;
        const maximum = Math.max(1, a?.value ?? 0, b?.value ?? 0);
        return (
          <View key={point.date} className="gap-3 rounded-2xl bg-raised p-4">
            <Text className="text-text-primary font-semibold">
              {day(point.date)}
            </Text>
            {comparable && (
              <Text className="text-text-secondary text-sm">
                {a.value === b.value
                  ? t('challenges.dayTie', { defaultValue: 'Tied day' })
                  : t('challenges.dayAhead', {
                      defaultValue: '{{name}} ahead this day',
                      name: entries[a.value > b.value ? 0 : 1]?.display_name,
                    })}
              </Text>
            )}
            {entries.map((entry, i) => {
              const p = entry.daily.find((d) => d.date === point.date);
              return (
                <View key={entry.user_id} className="gap-2">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="text-text-primary flex-shrink">
                      {entry.display_name}
                    </Text>
                    <Text className="text-text-secondary">{value(p)}</Text>
                  </View>
                  <View
                    accessible={false}
                    className="h-1.5 rounded-full bg-background"
                  >
                    <View
                      className={
                        i
                          ? 'h-full rounded-full bg-accent-primary/50'
                          : 'h-full rounded-full bg-accent-primary'
                      }
                      style={{
                        width: `${p?.present && p.eligible ? (Math.max(0, p.value) / maximum) * 100 : 0}%`,
                      }}
                    />
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
