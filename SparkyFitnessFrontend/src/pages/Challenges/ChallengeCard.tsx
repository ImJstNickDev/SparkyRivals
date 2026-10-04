import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { ChallengeResponse } from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeResults,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChallengeScores } from './ChallengeScores';
import { useChallengeFormat } from './presentation';

export function ChallengeCard({
  challenge,
  featured = false,
}: {
  challenge: ChallengeResponse;
  featured?: boolean;
}) {
  const { t, day, statuses, number, rules } = useChallengeFormat(
    challenge.metric,
    challenge.scoring_mode
  );
  const { actor } = useChallengeIdentity();
  const results = useChallengeResults(challenge);
  const pending = challenge.my_membership === 'pending';
  return (
    <article
      className={`space-y-5 rounded-3xl border bg-card p-5 sm:p-7 ${featured ? 'border-primary/30 bg-gradient-to-br from-primary/5 to-card shadow-sm' : ''} ${challenge.lifecycle === 'cancelled' ? 'text-muted-foreground' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Badge variant="secondary">
            {pending
              ? t('challenges.invitation', 'Invitation')
              : statuses[challenge.lifecycle]}
          </Badge>
          <p className="text-xs text-muted-foreground">{rules}</p>
          <h3 className="break-words text-2xl font-semibold tracking-tight">
            <Link
              className="hover:underline focus-visible:underline"
              to={`/challenges/${challenge.id}`}
            >
              {challenge.name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            {day(challenge.start_date)} – {day(challenge.end_date)}
          </p>
        </div>
        {challenge.lifecycle === 'active' && (
          <p className="text-sm font-medium">
            {t('challenges.daysLeft', '{{days}} days left', {
              count: challenge.progress.days_remaining,
              days: number(challenge.progress.days_remaining),
            })}
          </p>
        )}
      </div>
      {pending ? (
        <p className="text-muted-foreground">
          {challenge.metric === 'workout_time'
            ? t('challenges.workoutInvite', {
                defaultValue:
                  'A Workout Time Challenge is waiting. Review the rules before sharing aggregate workout time.',
              })
            : t(
                'challenges.invitationDescription',
                'A friendly steps Challenge is waiting. Review the rules before sharing your step totals.'
              )}
        </p>
      ) : challenge.lifecycle === 'cancelled' ? (
        <p>
          {challenge.metric === 'workout_time'
            ? t('challenges.workoutCancelledHint', {
                defaultValue: 'Cancelled. Workout time sharing has stopped.',
              })
            : t(
                'challenges.cancelledHint',
                'Cancelled. Step sharing has stopped.'
              )}
        </p>
      ) : results.isError ? (
        <p role="alert">
          {t(
            'challenges.resultsUnavailable',
            'Scores are unavailable. Open this Challenge to retry.'
          )}
        </p>
      ) : results.data ? (
        <ChallengeScores result={results.data} actor={actor} compact />
      ) : (
        <p role="status">{t('challenges.loadingScores', 'Loading scores…')}</p>
      )}
      <div className="flex justify-end">
        <Button asChild variant={featured || pending ? 'default' : 'outline'}>
          <Link to={`/challenges/${challenge.id}`}>
            {pending
              ? t('challenges.reviewInvitation', 'Review invitation')
              : t('challenges.view', 'View Challenge')}
            <ArrowUpRight aria-hidden className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
