import { challengeReadBlocked } from '@workspace/shared';
import { Link, useParams } from 'react-router-dom';
import { Check, RefreshCw } from 'lucide-react';
import {
  challengeMetricText,
  challengeTypeText,
  CHALLENGE_METRIC_UNITS,
  selectChallengeInvitees,
} from '@workspace/shared';
import {
  useChallengeDetail,
  useChallengeIdentity,
  useChallengeResults,
  useChallengeConnections,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import {
  ChallengeShell,
  ChallengeLoading,
  ChallengeError,
} from './ChallengeChrome';
import { ChallengeDailyHistory, ChallengeResultFacts } from './ChallengeScores';
import { ChallengeLobby } from './ChallengeLobby';
import { ChallengeActions } from './ChallengeActions';
import { ChallengeResultSummary } from './ChallengeResultSummary';
import { ChallengeDates, ChallengeUpdated } from './ChallengeTiming';
import { challengeIcons } from './icons';
import { useChallengeFormat } from './presentation';

export default function ChallengeDetailPage() {
  const { id = '' } = useParams();
  const { actor, enabled } = useChallengeIdentity();
  return (
    <ChallengeShell back>
      {enabled && (
        <ChallengeDetail key={`${actor}:${id}`} id={id} actor={actor} />
      )}
    </ChallengeShell>
  );
}
function ChallengeDetail({ id, actor }: { id: string; actor: string }) {
  const detail = useChallengeDetail(id);
  const results = useChallengeResults(detail.data?.challenge);
  const connections = useChallengeConnections();
  const { t, day, statuses, value, coverageHint } = useChallengeFormat();
  const challenge = detail.data?.challenge;
  const hasResults =
    challenge?.my_membership === 'accepted' &&
    ['active', 'completed'].includes(challenge.lifecycle);
  const refresh = () => {
    void detail.refetch();
    if (hasResults) void results.refetch();
  };
  if (challengeReadBlocked(detail.error) || challengeReadBlocked(results.error))
    return (
      <ChallengeError retry={refresh} error={detail.error ?? results.error} />
    );
  if (detail.isPending) return <ChallengeLoading />;
  if (!challenge || !detail.data)
    return <ChallengeError retry={refresh} error={detail.error} />;
  const pending = challenge.my_membership === 'pending';
  const accepted = challenge.my_membership === 'accepted';
  const Icon = challengeIcons[challenge.metric];
  const inviter = selectChallengeInvitees(connections.data ?? [], actor).find(
    (p) => p.user_id === challenge.creator_user_id
  )?.display_name;
  return (
    <>
      {detail.isError && (
        <ChallengeError retry={refresh} error={detail.error} />
      )}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Icon aria-hidden className="h-5 w-5 shrink-0" />
            {challengeTypeText(t, challenge.metric, challenge.scoring_mode)}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 shrink-0"
            disabled={detail.isFetching || results.isFetching}
            onClick={refresh}
            aria-label={t('challenges.refresh', {
              defaultValue: 'Refresh Challenges',
            })}
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
          </Button>
        </div>
        <h1 className="break-words text-3xl font-semibold tracking-tight">
          {challenge.name}
        </h1>
        {!pending && !['active', 'lobby'].includes(challenge.lifecycle) && (
          <p className="text-muted-foreground">
            {statuses[challenge.lifecycle]}
          </p>
        )}
        <ChallengeDates challenge={challenge} />
      </header>
      {pending ? (
        <>
          {inviter && (
            <p>
              {t('challenges.invitedBy', {
                defaultValue: 'Invited by {{name}}',
                name: inviter,
              })}
            </p>
          )}
          <section className="space-y-3">
            <h2 className="font-semibold">
              {t('challenges.ux.sharingTitle', {
                defaultValue: 'What you share',
              })}
            </h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              <li className="flex items-center gap-2">
                <Check aria-hidden className="h-4 w-4 text-primary" />
                <Icon aria-hidden className="h-5 w-5" />
                {challengeMetricText(t, challenge.metric)}
              </li>
              {challenge.scoring_mode !== 'sum' && (
                <li className="flex items-center gap-2">
                  <Check aria-hidden className="h-4 w-4 text-primary" />
                  {t('challenges.ux.targetLabel', {
                    defaultValue: 'Daily target',
                  })}
                </li>
              )}
              {challenge.metric.startsWith('workout_') && (
                <li className="flex items-center gap-2">
                  <Check aria-hidden className="h-4 w-4 text-primary" />
                  {t('challenges.ux.sessionsLabel', {
                    defaultValue: 'Session count',
                  })}
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t('challenges.ux.otherDataPrivate', {
                defaultValue: 'Other health data stays private.',
              })}
            </p>
            {['completed', 'cancelled'].includes(challenge.lifecycle) && (
              <p>
                {t('challenges.invitationClosed', {
                  defaultValue:
                    'This Challenge is closed. You can dismiss the invitation.',
                })}
              </p>
            )}
          </section>
          <ChallengeActions detail={detail.data} />
        </>
      ) : (
        accepted && (
          <>
            {challenge.lifecycle === 'lobby' && (
              <ChallengeLobby detail={detail.data} />
            )}
            {challenge.lifecycle === 'upcoming' && (
              <section className="space-y-2">
                <h2 className="text-xl font-semibold">
                  {t('challenges.ux.startsOn', {
                    defaultValue: 'Starts {{date}}',
                    date: day(challenge.start_date),
                  })}
                </h2>
                {challenge.scoring_mode !== 'sum' && (
                  <p className="text-muted-foreground">
                    {t('challenges.ux.targetsLocked', {
                      defaultValue: 'Targets are locked. Everything is ready.',
                    })}
                  </p>
                )}
              </section>
            )}
            {hasResults && (
              <>
                {results.isError && (
                  <ChallengeError
                    retry={() => void results.refetch()}
                    error={results.error}
                  />
                )}
                {results.data ? (
                  <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <ChallengeResultSummary
                      result={results.data}
                      actor={actor}
                    />
                    <details className="min-w-0">
                      <summary className="w-fit cursor-pointer py-3 text-sm font-medium text-primary">
                        {t('challenges.ux.dailyHistory', {
                          defaultValue: 'Daily history',
                        })}
                      </summary>
                      <ChallengeDailyHistory
                        result={results.data}
                        actor={actor}
                      />
                    </details>
                  </div>
                ) : (
                  !results.isError && <ChallengeLoading />
                )}
              </>
            )}
            {challenge.lifecycle === 'cancelled' && (
              <p className="text-muted-foreground">
                {t('challenges.cancelledAggregate', {
                  defaultValue:
                    'Cancelled. Challenge data sharing has stopped.',
                })}
              </p>
            )}
            {['completed', 'cancelled'].includes(challenge.lifecycle) && (
              <Button asChild>
                <Link to={`/challenges/new?rematch=${challenge.id}`}>
                  {t('challenges.rematch', { defaultValue: 'Rematch' })}
                </Link>
              </Button>
            )}
            {challenge.lifecycle !== 'lobby' &&
              detail.data.participants.length > 0 && (
                <details>
                  <summary className="w-fit cursor-pointer py-3 font-medium">
                    {t('challenges.participants', {
                      defaultValue: 'Participants',
                    })}
                  </summary>
                  <ul className="divide-y">
                    {detail.data.participants.map((p) => (
                      <li
                        key={p.user_id}
                        className="flex flex-wrap justify-between gap-2 py-3"
                      >
                        <span className="break-words">{p.display_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {p.status === 'accepted' && p.target_value != null
                            ? value(
                                p.target_value,
                                CHALLENGE_METRIC_UNITS[challenge.metric]
                              )
                            : t(`challenges.membership.${p.status}`, {
                                defaultValue: p.status,
                              })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            <details className="space-y-2">
              <summary className="w-fit cursor-pointer py-3 text-sm font-medium">
                {t('challenges.ux.details', {
                  defaultValue: 'Challenge details',
                })}
              </summary>
              {results.data && <ChallengeResultFacts result={results.data} />}
              <p className="text-sm text-muted-foreground">
                {challenge.timezone}
              </p>
              <p className="text-sm text-muted-foreground">{coverageHint}</p>
              <ChallengeActions detail={detail.data} />
            </details>
            {hasResults && results.data && (
              <ChallengeUpdated timestamp={results.data.calculated_at} />
            )}
          </>
        )
      )}
    </>
  );
}
