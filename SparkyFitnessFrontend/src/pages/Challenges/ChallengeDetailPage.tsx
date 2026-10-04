import { Link, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  useChallengeDetail,
  useChallengeIdentity,
  useChallengeResults,
  useChallengeConnections,
} from '@/hooks/Challenges/useChallenges';
import { challengeTypeLabel, selectChallengeInvitees } from '@workspace/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChallengeShell,
  ChallengeLoading,
  ChallengeError,
} from './ChallengeChrome';
import { ChallengeScores, ChallengeDailyHistory } from './ChallengeScores';
import { ChallengeLobby } from './ChallengeLobby';
import { ChallengeActions } from './ChallengeActions';
import { useChallengeFormat } from './presentation';

export default function ChallengeDetailPage() {
  const { id = '' } = useParams();
  const detail = useChallengeDetail(id);
  const results = useChallengeResults(detail.data?.challenge);
  const connections = useChallengeConnections();
  const { actor } = useChallengeIdentity();
  const { t, day, number, statuses, locale } = useChallengeFormat();
  const refresh = () => {
    void detail.refetch();
    if (
      detail.data?.challenge.my_membership === 'accepted' &&
      detail.data.challenge.lifecycle !== 'cancelled'
    )
      void results.refetch();
  };
  if (detail.isPending)
    return (
      <ChallengeShell back>
        <ChallengeLoading />
      </ChallengeShell>
    );
  if (detail.isError || !detail.data)
    return (
      <ChallengeShell back>
        <ChallengeError retry={refresh} />
      </ChallengeShell>
    );
  const { challenge, participants } = detail.data;
  const pending = challenge.my_membership === 'pending';
  const inviter = selectChallengeInvitees(connections.data ?? [], actor).find(
    (p) => p.user_id === challenge.creator_user_id
  )?.display_name;
  return (
    <ChallengeShell back>
      <header className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Badge variant="secondary">{statuses[challenge.lifecycle]}</Badge>
          <Button
            variant="outline"
            disabled={detail.isFetching || results.isFetching}
            onClick={refresh}
          >
            <RefreshCw aria-hidden className="mr-2 h-4 w-4" />
            {t('challenges.refresh', 'Refresh Challenges')}
          </Button>
        </div>
        <h1 className="break-words text-4xl font-semibold tracking-tight sm:text-5xl">
          {challenge.name}
        </h1>
        <p className="text-muted-foreground">
          {day(challenge.start_date)} – {day(challenge.end_date)} ·{' '}
          {challenge.timezone}
        </p>
        <p className="font-medium">
          {challenge.scoring_mode !== 'sum' ||
          !['steps', 'workout_time'].includes(challenge.metric)
            ? t(
                `challenges.typeLabels.${challenge.metric}.${challenge.scoring_mode}`,
                {
                  defaultValue: challengeTypeLabel(
                    challenge.metric,
                    challenge.scoring_mode
                  ),
                }
              )
            : challenge.metric === 'workout_time'
              ? t('challenges.workoutRules', {
                  defaultValue: 'Workout time · Highest total wins',
                })
              : t('challenges.rules', {
                  defaultValue: 'Steps · Highest total wins',
                })}
        </p>
        {challenge.lifecycle === 'active' && (
          <div className="space-y-2">
            <p>
              {t(
                'challenges.dayProgress',
                'Day {{current}} of {{total}} · {{remaining}} days left',
                {
                  current:
                    challenge.progress.current_day === null
                      ? '—'
                      : number(challenge.progress.current_day),
                  count: challenge.progress.days_remaining,
                  total: number(challenge.progress.total_days),
                  remaining: number(challenge.progress.days_remaining),
                }
              )}
            </p>
            <div
              role="progressbar"
              aria-label={t(
                'challenges.dateProgress',
                'Challenge time elapsed'
              )}
              aria-valuenow={challenge.progress.elapsed_days}
              aria-valuemax={challenge.progress.total_days}
              aria-valuemin={0}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary"
                style={{
                  width: `${(challenge.progress.elapsed_days / challenge.progress.total_days) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </header>
      {pending && (
        <section className="space-y-4 rounded-3xl border bg-primary/5 p-6">
          <h2 className="text-2xl font-semibold">
            {t('challenges.invitation', 'Invitation')}
          </h2>
          {inviter && (
            <p>
              {t('challenges.invitedBy', 'Invited by {{name}}', {
                name: inviter,
              })}
            </p>
          )}
          <p>
            {challenge.scoring_mode !== 'sum' ||
            !['steps', 'workout_time'].includes(challenge.metric)
              ? t('challenges.aggregateConsent', {
                  defaultValue:
                    'Only daily aggregates for the chosen metric and your chosen target are shared after acceptance. Other health data stays private.',
                })
              : challenge.metric === 'workout_time'
                ? t('challenges.workoutAcceptHint', {
                    defaultValue:
                      'Accept to share daily aggregate workout time and session counts for the whole Challenge date range, including earlier days. Workout details and other health data stay private.',
                  })
                : t(
                    'challenges.acceptPrivacy',
                    'Accept to share your daily step totals for the whole Challenge date range, including earlier days. Other health data stays private.'
                  )}
          </p>
          {challenge.lifecycle === 'completed' ||
          challenge.lifecycle === 'cancelled' ? (
            <p>
              {t(
                'challenges.invitationClosed',
                'This Challenge is closed. You can dismiss the invitation.'
              )}
            </p>
          ) : (
            <p>
              {t(
                'challenges.noScoresBeforeAccept',
                'Scores are visible after you accept.'
              )}
            </p>
          )}
        </section>
      )}
      {!pending && ['completed', 'cancelled'].includes(challenge.lifecycle) && (
        <Button asChild variant="outline">
          <Link to={`/challenges/new?rematch=${challenge.id}`}>
            {t('challenges.rematch', 'Rematch')}
          </Link>
        </Button>
      )}
      {!pending && challenge.scoring_mode !== 'sum' && (
        <ChallengeLobby detail={detail.data} />
      )}
      <ChallengeActions key={challenge.id} detail={detail.data} />
      {challenge.lifecycle === 'cancelled' ? (
        <p className="rounded-3xl bg-muted p-8 text-muted-foreground">
          {challenge.scoring_mode !== 'sum' ||
          !['steps', 'workout_time'].includes(challenge.metric)
            ? t('challenges.cancelledAggregate', {
                defaultValue: 'Cancelled. Challenge data sharing has stopped.',
              })
            : challenge.metric === 'workout_time'
              ? t('challenges.workoutCancelledHint', {
                  defaultValue: 'Cancelled. Workout time sharing has stopped.',
                })
              : t(
                  'challenges.cancelledHint',
                  'Cancelled. Step sharing has stopped.'
                )}
        </p>
      ) : (
        !pending &&
        challenge.lifecycle !== 'lobby' && (
          <>
            {challenge.lifecycle === 'completed' && (
              <section className="space-y-2">
                <h2 className="text-2xl font-semibold">
                  {t('challenges.currentResults', 'Current results')}
                </h2>
                <p className="text-muted-foreground">
                  {challenge.scoring_mode !== 'sum' ||
                  !['steps', 'workout_time'].includes(challenge.metric)
                    ? t('challenges.aggregateReconciles', {
                        defaultValue:
                          'Results can change when canonical data arrives late, is corrected or deleted. Locked targets stay unchanged.',
                      })
                    : challenge.metric === 'workout_time'
                      ? t('challenges.workoutReconciles', {
                          defaultValue:
                            'Results can change when workouts arrive late, are edited or deleted.',
                        })
                      : t(
                          'challenges.reconciles',
                          'Results can change when step data arrives late or is corrected.'
                        )}
                </p>
              </section>
            )}
            {results.isError ? (
              <ChallengeError retry={() => void results.refetch()} />
            ) : results.data ? (
              <>
                <ChallengeScores result={results.data} actor={actor} />
                <ChallengeDailyHistory
                  key={challenge.id}
                  result={results.data}
                  actor={actor}
                />
                <p className="text-xs text-muted-foreground">
                  {t('challenges.checkedAt', 'Results refreshed {{time}}', {
                    time: new Date(results.data.calculated_at).toLocaleString(
                      locale
                    ),
                  })}
                </p>
              </>
            ) : (
              <ChallengeLoading />
            )}
          </>
        )
      )}
      {!pending && participants.length > 0 && (
        <details className="rounded-2xl border p-5">
          <summary className="cursor-pointer font-semibold">
            {t('challenges.participants', 'Participants')}
          </summary>
          <ul className="mt-4 space-y-3">
            {participants.map((p) => (
              <li
                key={p.user_id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{p.display_name}</span>
                <span className="text-sm text-muted-foreground">
                  {p.status === 'accepted'
                    ? t('challenges.accepted', 'Joined')
                    : p.status === 'pending'
                      ? t('challenges.pending', 'Invited')
                      : p.status === 'left'
                        ? t('challenges.left', 'Left')
                        : p.status === 'withdrawn'
                          ? t('challenges.withdrawn', 'Withdrawn')
                          : t('challenges.declined', 'Declined')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </ChallengeShell>
  );
}
