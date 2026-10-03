import { useEffect } from 'react';
import {
  selectChallengeInvitees,
  CHALLENGE_MAX_PARTICIPANTS,
} from '@workspace/shared';
import {
  useChallengeConnections,
  useChallengeIdentity,
} from '@/hooks/Challenges/useChallenges';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChallengeError } from './ChallengeChrome';
import { useChallengeFormat } from './presentation';

export function ChallengeInvitees({
  selected,
  onChange,
  excluded = [],
  capacity = CHALLENGE_MAX_PARTICIPANTS - 1,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  excluded?: string[];
  capacity?: number;
}) {
  const { t } = useChallengeFormat();
  const { actor } = useChallengeIdentity();
  const connections = useChallengeConnections();
  const candidates = selectChallengeInvitees(
    connections.data ?? [],
    actor,
    excluded
  );
  useEffect(() => {
    if (!connections.data || connections.isError || connections.isFetching)
      return;
    const allowed = selectChallengeInvitees(connections.data, actor, excluded);
    const retained = selected.filter((id) =>
      allowed.some((p) => p.user_id === id)
    );
    if (retained.length !== selected.length) onChange(retained);
  }, [
    connections.data,
    connections.isError,
    connections.isFetching,
    actor,
    excluded,
    selected,
    onChange,
  ]);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 font-semibold">
        {t('challenges.inviteFriends', 'Invite Family & Friends')}
      </legend>
      <p className="text-sm text-muted-foreground">
        {t(
          'challenges.consentHint',
          'Each person chooses whether to join. Only Challenge step data is shared.'
        )}
      </p>
      {connections.isPending ? (
        <p role="status">
          {t('challenges.loadingConnections', 'Loading connections…')}
        </p>
      ) : connections.isError ? (
        <ChallengeError retry={() => void connections.refetch()} />
      ) : !candidates.length ? (
        <p className="rounded-xl bg-muted p-4 text-sm">
          {t(
            'challenges.noConnections',
            'No eligible connections. Manage Family & Friends in web Settings, or create a Challenge and invite them later.'
          )}
        </p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
          {candidates.map((person) => (
            <Label
              key={person.user_id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(person.user_id)}
                disabled={
                  !selected.includes(person.user_id) &&
                  selected.length >= capacity
                }
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, person.user_id]
                      : selected.filter((id) => id !== person.user_id)
                  )
                }
              />
              <span className="break-words">
                {person.display_name ||
                  t('challenges.participant', 'Participant')}
              </span>
            </Label>
          ))}
        </div>
      )}
      {capacity <= 0 && (
        <p>
          {t(
            'challenges.capacity',
            'This Challenge has reached its participant limit.'
          )}
        </p>
      )}
    </fieldset>
  );
}
