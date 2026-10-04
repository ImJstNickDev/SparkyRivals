import {
  formatChallengeValue,
  CHALLENGE_METRIC_UNITS,
} from '@workspace/shared';
import { useState } from 'react';
import type {
  ChallengeLeaderboardResponse,
  ChallengeDailyScore,
} from '@workspace/shared';
import { Trophy, Footprints, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useChallengeFormat } from './presentation';

export function ChallengeScores({
  result,
  actor,
  compact = false,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
  compact?: boolean;
}) {
  const {
    t,
    number,
    locale,
    score,
    noData,
    totalLabel,
    coverageHint,
    workoutCount,
    leading,
    behind,
    coverage,
    solo,
  } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
  const entries = compact ? result.entries.slice(0, 3) : result.entries;
  const ownEntry = result.entries.find((e) => e.user_id === actor);
  if (compact && ownEntry && !entries.includes(ownEntry))
    entries.push(ownEntry);
  const leaders = result.entries.filter((e) =>
    result.leader_user_ids.includes(e.user_id)
  );
  const names = new Intl.ListFormat(locale).format(
    leaders.map((e) => e.display_name)
  );
  const maximum = Math.max(1, result.entries[0]?.total_score ?? 0);
  const versus = result.entries.length === 2;
  return (
    <div className="space-y-6">
      {result.ranking_available && leaders.length > 0 && (
        <p className="flex items-start gap-2 text-lg font-semibold">
          <Trophy aria-hidden className="mt-1 h-5 w-5 shrink-0" />
          {result.challenge.lifecycle === 'completed'
            ? leaders.length > 1
              ? t(
                  'challenges.currentTiedWinners',
                  'Current tied winners: {{names}}',
                  { names }
                )
              : t('challenges.currentWinner', 'Current winner: {{name}}', {
                  name: names,
                })
            : leaders.length > 1
              ? t('challenges.tiedLead', '{{names}} share the lead', { names })
              : result.lead_margin !== null
                ? leading(names, result.lead_margin)
                : solo}
        </p>
      )}
      <ol
        aria-label={t('challenges.leaderboard', 'Leaderboard')}
        className={versus ? 'grid gap-4 sm:grid-cols-2' : 'space-y-3'}
      >
        {entries.map((entry) => (
          <li
            key={entry.user_id}
            className={`min-w-0 rounded-2xl border p-5 ${entry.rank === 1 ? 'border-primary/30 bg-primary/5' : 'bg-card'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="break-words font-semibold">
                {entry.display_name}
                {entry.user_id === actor && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {t('challenges.you', '(you)')}
                  </span>
                )}
              </p>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {entry.rank === null
                  ? t('challenges.notRanked', 'Not ranked yet')
                  : t('challenges.rank', 'Rank {{rank}}', {
                      rank: number(entry.rank),
                    })}
                {entry.is_tied && ` · ${t('challenges.tied', 'Tied')}`}
              </span>
            </div>
            <p
              className={`${versus ? 'text-4xl sm:text-5xl' : 'text-3xl'} mt-4 font-semibold tracking-tight tabular-nums`}
            >
              {score(entry.total_score)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{totalLabel}</p>
            {entry.target_value != null && (
              <p className="text-sm text-muted-foreground">
                {t('challenges.targetDisplay', {
                  defaultValue: 'Daily target: {{target}}',
                  target: formatChallengeValue(
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
            <div
              aria-hidden
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
                style={{
                  width: `${(Math.max(0, entry.total_score) / maximum) * 100}%`,
                }}
              />
            </div>
            {entry.today && (
              <p className="mt-3 text-sm">
                {t('challenges.todayValue', 'Today: {{value}}', {
                  value: entry.today.present
                    ? score(entry.today.value)
                    : noData,
                })}
              </p>
            )}
            {!compact && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  {coverage(
                    entry.coverage.days_with_data ??
                      entry.coverage.days_with_steps ??
                      0,
                    entry.coverage.eligible_days
                  )}
                </p>
                {entry.gap_to_leader !== null && entry.gap_to_leader > 0 && (
                  <p className="mt-1 text-sm">{behind(entry.gap_to_leader)}</p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      {compact && result.entries.length > 3 && (
        <p className="text-sm text-muted-foreground">
          {t(
            'challenges.moreCompetitors',
            '{{number}} participants in this Challenge',
            { number: number(result.entries.length) }
          )}
        </p>
      )}
      {!compact && (
        <p className="text-sm text-muted-foreground">{coverageHint}</p>
      )}
    </div>
  );
}

export function ChallengeDailyHistory({
  result,
  actor,
}: {
  result: ChallengeLeaderboardResponse;
  actor: string;
}) {
  const { t, number, day, noData, scoreWithUnit, workoutCount } =
    useChallengeFormat(result.challenge.metric, result.challenge.scoring_mode);
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
    <section className="space-y-5 rounded-3xl border bg-card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {result.challenge.metric === 'workout_time' ? (
            <Timer aria-hidden className="h-5 w-5" />
          ) : (
            <Footprints aria-hidden className="h-5 w-5" />
          )}
          {t('challenges.dailyHistory', 'Every day counts')}
        </h2>
        {!versus && (
          <div>
            <Label htmlFor="history-person" className="sr-only">
              {t('challenges.participant', 'Participant')}
            </Label>
            <select
              id="history-person"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="max-w-full rounded-lg border bg-background p-2 text-sm"
            >
              {result.entries.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {e.display_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {visible.map((point) => {
          const a = entries[0]?.daily.find((p) => p.date === point.date);
          const b = entries[1]?.daily.find((p) => p.date === point.date);
          const comparable =
            a?.eligible && b?.eligible && a.present && b.present;
          const max = Math.max(1, a?.value ?? 0, b?.value ?? 0);
          return (
            <div key={point.date} className="rounded-2xl bg-muted/40 p-4">
              <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm font-medium">
                <time dateTime={point.date}>{day(point.date)}</time>
                {comparable && (
                  <span>
                    {a.value === b.value
                      ? t('challenges.dayTie', 'Tied day')
                      : t('challenges.dayAhead', '{{name}} ahead this day', {
                          name:
                            entries[a.value > b.value ? 0 : 1]?.display_name ??
                            t('challenges.participant', 'Participant'),
                        })}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {entries.map((entry, i) => {
                  const p = entry.daily.find((d) => d.date === point.date);
                  return (
                    <div key={entry.user_id}>
                      <div className="mb-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="break-words">
                          {entry.display_name}
                        </span>
                        <span className="tabular-nums">
                          {value(p)}
                          {p?.present &&
                            p.actual_value !== undefined &&
                            entry.target_value != null && (
                              <span className="text-sm text-muted-foreground">
                                {formatChallengeValue(
                                  p.actual_value,
                                  CHALLENGE_METRIC_UNITS[
                                    result.challenge.metric
                                  ]
                                )}{' '}
                                /{' '}
                                {formatChallengeValue(
                                  entry.target_value,
                                  CHALLENGE_METRIC_UNITS[
                                    result.challenge.metric
                                  ]
                                )}{' '}
                                · {number(p.progress_points ?? 0)}%
                              </span>
                            )}
                          {p?.present && p.workout_count !== undefined && (
                            <span className="block text-xs text-muted-foreground">
                              {workoutCount(p.workout_count)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div aria-hidden className="h-1.5 rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${i ? 'bg-primary/50' : 'bg-primary'}`}
                          style={{
                            width: `${p?.present && p.eligible ? (Math.max(0, p.value) / max) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {points.length > 7 && (
        <nav
          aria-label={t('challenges.historyPages', 'Daily history pages')}
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {t('challenges.previousDays', 'Earlier days')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('challenges.page', '{{current}} / {{total}}', {
              current: number(currentPage + 1),
              total: number(Math.ceil(points.length / 7)),
            })}
          </span>
          <Button
            variant="outline"
            disabled={(currentPage + 1) * 7 >= points.length}
            onClick={() => setPage(currentPage + 1)}
          >
            {t('challenges.nextDays', 'Later days')}
          </Button>
        </nav>
      )}
    </section>
  );
}
