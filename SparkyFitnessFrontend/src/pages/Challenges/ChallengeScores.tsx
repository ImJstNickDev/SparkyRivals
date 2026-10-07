import {
  challengeDayComparison,
  challengeDayState,
  CHALLENGE_METRIC_UNITS,
} from '@workspace/shared';
import { useState } from 'react';
import type {
  ChallengeLeaderboardResponse,
  ChallengeDailyScore,
} from '@workspace/shared';
import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useChallengeFormat } from './presentation';

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
    value: formatValue,
    workoutCount,
  } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
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
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(points.length / 7) - 1)
  );
  const visible = points.slice(currentPage * 7, currentPage * 7 + 7);
  const value = (point?: ChallengeDailyScore) =>
    !point?.eligible
      ? t('challenges.notStarted', 'Not started')
      : !point.present
        ? noData
        : scoreWithUnit(point.value);
  return (
    <section
      className="space-y-4"
      aria-label={t('challenges.ux.dailyHistory', {
        defaultValue: 'Daily history',
      })}
    >
      {!versus && (
        <div>
          <Label htmlFor="history-person" className="sr-only">
            {t('challenges.participant', { defaultValue: 'Participant' })}
          </Label>
          <select
            id="history-person"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-h-12 max-w-full rounded-md border bg-background p-2 text-sm"
          >
            {result.entries.map((e) => (
              <option key={e.user_id} value={e.user_id}>
                {e.display_name}
              </option>
            ))}
          </select>
        </div>
      )}
      <ol className="divide-y">
        {visible.map((point) => {
          const comparison = challengeDayComparison(
            entries[0]?.daily.find((p) => p.date === point.date),
            entries[1]?.daily.find((p) => p.date === point.date)
          );
          return (
            <li key={point.date} className="space-y-3 py-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                <time dateTime={point.date}>{day(point.date)}</time>
                {comparison && (
                  <span className="text-muted-foreground">
                    {comparison === 'tie'
                      ? t('challenges.dayTie', { defaultValue: 'Tied day' })
                      : t('challenges.dayAhead', {
                          defaultValue: '{{name}} ahead this day',
                          name:
                            entries[comparison === 'first' ? 0 : 1]
                              ?.display_name ?? '',
                        })}
                  </span>
                )}
              </div>
              {entries.map((entry) => {
                const p = entry.daily.find((d) => d.date === point.date);
                const state = challengeDayState(p);
                return (
                  <div key={entry.user_id} className="space-y-1 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="min-w-0 break-words">
                        {entry.display_name}
                      </span>
                      <span className="font-medium tabular-nums">
                        {value(p)}
                      </span>
                    </div>
                    {(state === 'reached' || state === 'notReached') && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {state === 'reached' ? (
                          <Check aria-hidden className="h-3 w-3" />
                        ) : (
                          <Minus aria-hidden className="h-3 w-3" />
                        )}
                        {state === 'reached'
                          ? t('challenges.ux.goalReached', {
                              defaultValue: 'Goal reached',
                            })
                          : t('challenges.ux.goalNotReached', {
                              defaultValue: 'Goal not reached',
                            })}
                      </p>
                    )}
                    {p?.eligible &&
                      p.present &&
                      p.actual_value !== undefined &&
                      entry.target_value != null && (
                        <p className="text-xs text-muted-foreground">
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
                        </p>
                      )}
                    {p?.eligible &&
                      p.present &&
                      p.workout_count !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {workoutCount(p.workout_count)}
                        </p>
                      )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>
      {points.length > 7 && (
        <nav
          aria-label={t('challenges.historyPages', {
            defaultValue: 'Daily history pages',
          })}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            type="button"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {t('challenges.previousDays', { defaultValue: 'Earlier days' })}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('challenges.page', {
              defaultValue: '{{current}} / {{total}}',
              current: number(currentPage + 1),
              total: number(Math.ceil(points.length / 7)),
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={(currentPage + 1) * 7 >= points.length}
            onClick={() => setPage(currentPage + 1)}
          >
            {t('challenges.nextDays', { defaultValue: 'Later days' })}
          </Button>
        </nav>
      )}
    </section>
  );
}

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
    <div className="space-y-4">
      {result.entries.map((entry) => (
        <div key={entry.user_id} className="space-y-1">
          <p className="font-medium">{entry.display_name}</p>
          {entry.target_value != null && (
            <p className="text-sm text-muted-foreground">
              {t('challenges.targetDisplay', {
                defaultValue: 'Daily target: {{target}}',
                target: value(
                  entry.target_value,
                  CHALLENGE_METRIC_UNITS[result.challenge.metric]
                ),
              })}
            </p>
          )}
          {entry.total_workout_count !== undefined && (
            <p className="text-sm text-muted-foreground">
              {workoutCount(entry.total_workout_count)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {coverage(
              entry.coverage.days_with_data ??
                entry.coverage.days_with_steps ??
                0,
              entry.coverage.eligible_days
            )}
          </p>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">{coverageHint}</p>
    </div>
  );
}
