import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { challengeIcons } from './icons';
import type { ChallengeResponse } from '@workspace/shared';
import { useChallengeFormat } from './presentation';

export function ChallengeCard({
  challenge,
}: {
  challenge: ChallengeResponse;
  featured?: boolean;
}) {
  const { t, day, statuses, rules } = useChallengeFormat(
    challenge.metric,
    challenge.scoring_mode
  );
  const Icon = challengeIcons[challenge.metric];
  const status =
    challenge.my_membership === 'pending'
      ? t('challenges.reviewInvitation', { defaultValue: 'Review invitation' })
      : challenge.lifecycle === 'active'
        ? t('challenges.ux.endsOn', {
            defaultValue: 'Ends {{date}}',
            date: day(challenge.end_date),
          })
        : challenge.lifecycle === 'lobby' && challenge.my_ready
          ? t('challenges.ux.readyWaiting', {
              defaultValue: "You're ready · Waiting for others",
            })
          : statuses[challenge.lifecycle];
  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className="flex min-h-16 items-center gap-4 rounded-md py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('challenges.openNamed', {
        defaultValue: 'Open {{name}}',
        name: challenge.name,
      })}
    >
      <Icon aria-hidden className="h-6 w-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="break-words font-semibold">{challenge.name}</h3>
        <p className="text-sm text-muted-foreground">{rules}</p>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
