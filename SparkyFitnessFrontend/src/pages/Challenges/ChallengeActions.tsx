import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  challengeNameSchema,
  type ChallengeDetailResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChallengeInvitees } from './ChallengeInvitees';
import { useChallengeFormat } from './presentation';

export function ChallengeActions({
  detail,
}: {
  detail: ChallengeDetailResponse;
}) {
  const { challenge, participants } = detail;
  const { t } = useChallengeFormat();
  const { actor } = useChallengeIdentity();
  const mutation = useChallengeMutation();
  const navigate = useNavigate();
  const busy = useRef(false);
  const [dialog, setDialog] = useState<
    'rename' | 'invite' | 'leave' | 'cancel' | null
  >(null);
  const [name, setName] = useState(challenge.name);
  const [selected, setSelected] = useState<string[]>([]);
  const open =
    challenge.lifecycle === 'lobby' ||
    challenge.lifecycle === 'active' ||
    challenge.lifecycle === 'upcoming';
  const owner = actor === challenge.creator_user_id;
  const capacity = CHALLENGE_MAX_PARTICIPANTS - participants.length;
  const labels = {
    rename: t('challenges.rename', 'Rename'),
    invite: t('challenges.invite', 'Invite'),
    leave: t('challenges.leave', 'Leave Challenge'),
    cancel: t('challenges.cancelChallenge', 'Cancel Challenge'),
  };
  const submit = async (
    action: 'accept' | 'decline' | 'leave' | 'cancel' | 'rename' | 'invite'
  ) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (action === 'rename')
        await mutation.mutateAsync({
          action,
          id: challenge.id,
          name: challengeNameSchema.parse(name),
        });
      else if (action === 'invite') {
        if (selected[0])
          await mutation.mutateAsync({
            action,
            id: challenge.id,
            userId: selected[0],
          });
      } else await mutation.mutateAsync({ action, id: challenge.id });
      setDialog(null);
      setSelected([]);
      if (action === 'leave' || action === 'decline')
        navigate('/challenges', { replace: true });
    } catch {
      /* Keep the form and typed inputs; mutation error is rendered. */
    } finally {
      busy.current = false;
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {challenge.my_membership === 'pending' && (
          <>
            {open && (
              <Button
                disabled={mutation.isPending}
                onClick={() => void submit('accept')}
              >
                {t('challenges.accept', 'Accept invitation')}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => void submit('decline')}
            >
              {t('challenges.decline', 'Decline')}
            </Button>
          </>
        )}
        {owner && open && challenge.my_membership === 'accepted' && (
          <>
            {(challenge.scoring_mode === 'sum' ||
              challenge.lifecycle === 'lobby') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelected([]);
                  mutation.reset();
                  setDialog('invite');
                }}
                disabled={capacity <= 0}
              >
                {labels.invite}
              </Button>
            )}
            {['lobby', 'upcoming'].includes(challenge.lifecycle) && (
              <Button
                variant="outline"
                onClick={() => {
                  setName(challenge.name);
                  mutation.reset();
                  setDialog('rename');
                }}
              >
                {labels.rename}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                mutation.reset();
                setDialog('cancel');
              }}
            >
              {labels.cancel}
            </Button>
          </>
        )}
        {!owner && challenge.my_membership === 'accepted' && (
          <Button
            variant="ghost"
            onClick={() => {
              mutation.reset();
              setDialog('leave');
            }}
          >
            {labels.leave}
          </Button>
        )}
      </div>
      {mutation.isError && !dialog && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            'challenges.actionError',
            'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.'
          )}
        </p>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog && labels[dialog]}</DialogTitle>
            <DialogDescription>
              {dialog === 'cancel'
                ? t('challenges.ux.cancelConfirm', {
                    defaultValue:
                      'Cancel for everyone? Challenge sharing stops. This cannot be undone.',
                  })
                : dialog === 'leave'
                  ? t('challenges.ux.leaveConfirm', {
                      defaultValue:
                        'Leave this Challenge? Your results will be removed, and you cannot rejoin.',
                    })
                  : t(
                      'challenges.rulesFixed',
                      'Dates, timezone and scoring stay the same.'
                    )}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'rename' && (
            <div className="space-y-2">
              <Label htmlFor="challenge-rename">
                {t('challenges.name', 'Challenge name')}
              </Label>
              <Input
                id="challenge-rename"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {dialog === 'invite' && (
            <ChallengeInvitees
              selected={selected}
              onChange={setSelected}
              excluded={participants.map((p) => p.user_id)}
              capacity={Math.min(1, capacity)}
            />
          )}
          {mutation.isError && (
            <p role="alert">
              {t(
                'challenges.actionError',
                'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.'
              )}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setDialog(null)}
            >
              {t('challenges.keep', 'Go back')}
            </Button>
            <Button
              variant={
                dialog === 'cancel' || dialog === 'leave'
                  ? 'destructive'
                  : 'default'
              }
              disabled={
                mutation.isPending ||
                (dialog === 'rename' &&
                  !challengeNameSchema.safeParse(name).success) ||
                (dialog === 'invite' && selected.length !== 1)
              }
              onClick={() => dialog && void submit(dialog)}
            >
              {mutation.isPending
                ? t('challenges.saving', 'Saving…')
                : dialog && labels[dialog]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
