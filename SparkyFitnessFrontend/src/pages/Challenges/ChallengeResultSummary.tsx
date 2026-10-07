import { useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  CHALLENGE_METRIC_UNITS,
  challengePointPrecision,
  formatChallengePoints,
  type ChallengeLeaderboardResponse,
} from '@workspace/shared';
import { useChallengeFormat } from './presentation';
import { challengeIcons } from './icons';

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
    unitLabel,
    value: formatValue,
    noData,
    number,
  } = useChallengeFormat(
    result.challenge.metric,
    result.challenge.scoring_mode
  );
  const [actuals, setActuals] = useState<Set<string>>(() => new Set());
  const own = result.entries.find((entry) => entry.user_id === actor);
  const goal = result.challenge.scoring_mode !== 'sum';
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
  const place =
    own?.rank == null
      ? null
      : t('challenges.ux.place', {
          count: own.rank,
          ordinal: true,
          number: number(own.rank),
          defaultValue: '{{number}}th place',
          defaultValue_ordinal_one: '{{number}}st place',
          defaultValue_ordinal_two: '{{number}}nd place',
          defaultValue_ordinal_few: '{{number}}rd place',
          defaultValue_ordinal_other: '{{number}}th place',
        });
  const position = own?.is_tied
    ? t('challenges.ux.tiedPlace', { defaultValue: 'Joint {{place}}', place })
    : place;
  const today = own?.today;
  const progress =
    today?.eligible && today.present ? today.progress_points : undefined;
  return (
    <section className="space-y-6">
      {own && (
        <div className="space-y-5">
          <div className="space-y-2 rounded-2xl bg-muted/50 p-5">
            <p className="text-muted-foreground">
              {t('challenges.ux.yourTotal', { defaultValue: 'Your total' })}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="break-all text-5xl font-bold tabular-nums">
                {points(own)}
              </p>
              <span className="text-lg text-muted-foreground">
                {unitLabel(own.total_score)}
              </span>
            </div>
            {own.rank !== null && (
              <p className="font-semibold text-primary">
                {t('challenges.ux.placeAndPlayers', {
                  defaultValue: '{{place}} · {{number}} players',
                  defaultValue_one: '{{place}} · {{number}} player',
                  place: position,
                  number: number(result.entries.length),
                  count: result.entries.length,
                })}
              </p>
            )}
          </div>
          {today && (
            <div className="space-y-2">
              <p>
                {progress !== undefined
                  ? t('challenges.ux.todayPercent', {
                      defaultValue: 'Today {{percent}}%',
                      percent: number(progress),
                    })
                  : t('challenges.todayValue', {
                      defaultValue: 'Today: {{value}}',
                      value:
                        today.eligible && today.present
                          ? scoreWithUnit(today.value)
                          : noData,
                    })}
              </p>
              {goal &&
                today.present &&
                today.actual_value !== undefined &&
                own.target_value != null && (
                  <>
                    <p className="text-sm text-muted-foreground">
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
                    </p>
                    {progress !== undefined && (
                      <div
                        role="img"
                        aria-label={t('challenges.ux.goalPercent', {
                          defaultValue: '{{percent}}% of your daily target',
                          percent: number(progress),
                        })}
                        className="relative h-2 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, (progress / Math.max(100, progress)) * 100)}%`,
                          }}
                        />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-foreground"
                          style={{
                            left: `${Math.min(99, (100 / Math.max(100, progress)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
            </div>
          )}
        </div>
      )}
      <div>
        <h2 className="mb-2 text-lg font-semibold">
          {t('challenges.ux.standings', { defaultValue: 'Standings' })}
        </h2>
        <ol
          className="divide-y"
          aria-label={t('challenges.ux.standings', {
            defaultValue: 'Standings',
          })}
        >
          {result.entries.map((entry) => {
            const actual = goal && actuals.has(entry.user_id);
            const Row = goal ? 'button' : 'div';
            const Icon =
              actual || !goal
                ? challengeIcons[result.challenge.metric]
                : Trophy;
            const value = actual
              ? formatValue(
                  entry.total_actual_value ?? entry.total_score,
                  CHALLENGE_METRIC_UNITS[result.challenge.metric]
                )
              : goal
                ? points(entry)
                : scoreWithUnit(entry.total_score);
            return (
              <li key={entry.user_id}>
                <Row
                  type={goal ? 'button' : undefined}
                  className="flex min-h-12 w-full items-center gap-3 rounded py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('challenges.ux.standingValue', {
                    defaultValue: '{{name}}, rank {{rank}}, {{value}}',
                    name: entry.display_name,
                    rank: entry.rank ?? '—',
                    value:
                      actual || !goal
                        ? value
                        : t('challenges.valueWithUnit', {
                            defaultValue: '{{value}} {{unit}}',
                            value,
                            unit: unitLabel(entry.total_score),
                          }),
                  })}
                  title={
                    !goal
                      ? undefined
                      : actual
                        ? t('challenges.ux.showPoints', {
                            defaultValue: 'Show score',
                          })
                        : t('challenges.ux.showActual', {
                            defaultValue: 'Show accumulated activity',
                          })
                  }
                  onClick={
                    !goal
                      ? undefined
                      : () =>
                          setActuals((previous) => {
                            const next = new Set(previous);
                            if (next.has(entry.user_id))
                              next.delete(entry.user_id);
                            else next.add(entry.user_id);
                            return next;
                          })
                  }
                >
                  <span className="w-7 shrink-0 text-muted-foreground">
                    {entry.rank == null ? '—' : number(entry.rank)}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-semibold">
                    {entry.display_name}
                    {entry.user_id === actor
                      ? ` ${t('challenges.you', { defaultValue: '(you)' })}`
                      : ''}
                    {entry.is_tied && (
                      <span className="block text-sm font-normal text-muted-foreground">
                        {t('challenges.tied', { defaultValue: 'Tied' })}
                      </span>
                    )}
                  </span>
                  <span className="flex max-w-[50%] items-center gap-1">
                    <Icon
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-primary"
                    />
                    <span className="break-all font-semibold tabular-nums">
                      {value}
                    </span>
                  </span>
                </Row>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
