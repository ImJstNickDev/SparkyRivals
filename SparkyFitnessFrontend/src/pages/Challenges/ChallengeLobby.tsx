import { useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  todayInZone,
  suggestedChallengeTarget,
  CHALLENGE_METRIC_UNITS,
  type ChallengeDetailResponse,
  type ChallengeParticipantResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '@/hooks/Challenges/useChallenges';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useDailyGoals } from '@/hooks/Goals/useGoals';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChallengeTargetForm } from './ChallengeTargetForm';
import { useChallengeFormat } from './presentation';

export function ChallengeLobby({
  detail,
}: {
  detail: ChallengeDetailResponse;
}) {
  const { challenge, participants } = detail;
  const { actor } = useChallengeIdentity();
  const { t, value } = useChallengeFormat(
    challenge.metric,
    challenge.scoring_mode
  );
  const { timezone } = usePreferences();
  const goals = useDailyGoals(todayInZone(timezone || challenge.timezone));
  const mutation = useChallengeMutation();
  const own = participants.find((p) => p.user_id === actor);
  const [remove, setRemove] = useState<ChallengeParticipantResponse | null>(
    null
  );
  const removing = useRef(false);
  const lobby = challenge.lifecycle === 'lobby';
  const removePlayer = async () => {
    if (!remove || removing.current) return;
    removing.current = true;
    try {
      await mutation.mutateAsync({
        action: remove.status === 'pending' ? 'withdraw' : 'removeParticipant',
        id: challenge.id,
        userId: remove.user_id,
      });
      setRemove(null);
    } catch {
      /* Keep confirmation and show the failed state. */
    } finally {
      removing.current = false;
    }
  };
  return (
    <section className="space-y-6">
      {lobby &&
        own &&
        (goals.isPending ? (
          <p role="status">
            {t('common.loading', { defaultValue: 'Loading…' })}
          </p>
        ) : (
          <ChallengeTargetForm
            key={`${actor}:${challenge.id}`}
            detail={detail}
            own={own}
            suggested={
              goals.data
                ? suggestedChallengeTarget(challenge.metric, goals.data)
                : null
            }
          />
        ))}
      <div>
        <h2 className="text-lg font-semibold">
          {t('challenges.participants', { defaultValue: 'Participants' })}
        </h2>
        <ul className="divide-y">
          {participants
            .filter((p) => p.status === 'accepted' || p.status === 'pending')
            .map((p) => {
              const removable =
                lobby &&
                actor === challenge.creator_user_id &&
                p.user_id !== actor;
              const status =
                p.status === 'pending'
                  ? t('challenges.pending', { defaultValue: 'Invited' })
                  : (p.ready_at || !lobby) && p.target_value != null
                    ? value(
                        p.target_value,
                        CHALLENGE_METRIC_UNITS[challenge.metric]
                      )
                    : t('challenges.ux.choosing', { defaultValue: 'Choosing' });
              return (
                <li
                  key={p.user_id}
                  className="flex min-h-12 items-center gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 break-words font-medium">
                    {p.display_name}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {status}
                  </span>
                  {removable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={mutation.isPending}
                          aria-label={t('challenges.ux.playerActions', {
                            defaultValue: 'Actions for {{name}}',
                            name: p.display_name,
                          })}
                        >
                          <MoreHorizontal aria-hidden className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => {
                            mutation.reset();
                            setRemove(p);
                          }}
                        >
                          {t('challenges.ux.remove', {
                            defaultValue: 'Remove',
                          })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
        </ul>
      </div>
      <AlertDialog
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('challenges.ux.removeParticipant', {
                defaultValue: 'Remove {{name}}?',
                name: remove?.display_name ?? '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {remove?.status === 'pending'
                ? t('challenges.withdraw', {
                    defaultValue: 'Withdraw invitation',
                  })
                : t('challenges.ux.removeFromLobby', {
                    defaultValue: 'Remove this participant from the lobby.',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {t('challenges.actionError', {
                defaultValue:
                  'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.',
              })}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void removePlayer();
              }}
            >
              {t('challenges.ux.remove', { defaultValue: 'Remove' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
