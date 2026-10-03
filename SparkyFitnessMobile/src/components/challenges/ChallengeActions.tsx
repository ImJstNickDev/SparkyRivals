import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  challengeNameSchema,
  type ChallengeDetailResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '../../hooks/useChallenges';
import Button from '../ui/Button';
import FormInput from '../FormInput';
import { ChallengeInvitees } from './ChallengeInvitees';
import { ChallengeMutationError, useChallengeFormat } from './ChallengeChrome';

export function ChallengeActions({
  detail,
  onDepart,
}: {
  detail: ChallengeDetailResponse;
  onDepart: () => void;
}) {
  const { challenge, participants } = detail;
  const { t } = useChallengeFormat();
  const { actor } = useChallengeIdentity();
  const mutation = useChallengeMutation();
  const busy = useRef(false);
  const [editor, setEditor] = useState<'rename' | 'invite' | null>(null);
  const [name, setName] = useState(challenge.name);
  const [selected, setSelected] = useState<string[]>([]);
  const open =
    challenge.lifecycle === 'active' || challenge.lifecycle === 'upcoming';
  const owner = actor === challenge.creator_user_id;
  const capacity = CHALLENGE_MAX_PARTICIPANTS - participants.length;
  const labels = {
    rename: t('challenges.rename', { defaultValue: 'Rename' }),
    invite: t('challenges.invite', { defaultValue: 'Invite' }),
    leave: t('challenges.leave', { defaultValue: 'Leave Challenge' }),
    cancel: t('challenges.cancelChallenge', {
      defaultValue: 'Cancel Challenge',
    }),
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
        if (!selected[0]) return;
        await mutation.mutateAsync({
          action,
          id: challenge.id,
          userId: selected[0],
        });
      } else await mutation.mutateAsync({ action, id: challenge.id });
      setEditor(null);
      setSelected([]);
      if (action === 'leave' || action === 'decline') onDepart();
    } catch {
      /* Preserve inputs on failure; no optimistic membership changes. */
    } finally {
      busy.current = false;
    }
  };
  const confirm = (action: 'leave' | 'cancel') =>
    Alert.alert(
      labels[action],
      action === 'leave'
        ? challenge.metric === 'workout_time'
          ? t('challenges.workoutLeaveConfirm', {
              defaultValue:
                'Leave this Challenge? Your workout time will be removed from its results, and you cannot rejoin.',
            })
          : t('challenges.leaveConfirm', {
              defaultValue:
                'Leave this Challenge? Your steps will be removed from its results, and you cannot rejoin.',
            })
        : challenge.metric === 'workout_time'
          ? t('challenges.workoutCancelConfirm', {
              defaultValue:
                'Cancel for everyone? Workout time sharing stops and this cannot be undone.',
            })
          : t('challenges.cancelConfirm', {
              defaultValue:
                'Cancel for everyone? Step sharing stops and this cannot be undone.',
            }),
      [
        {
          text: t('challenges.keep', { defaultValue: 'Go back' }),
          style: 'cancel',
        },
        {
          text: labels[action],
          style: 'destructive',
          onPress: () => void submit(action),
        },
      ]
    );
  return (
    <View className="gap-3">
      {challenge.my_membership === 'pending' && (
        <>
          {open && (
            <Button
              accessibilityRole="button"
              disabled={mutation.isPending}
              onPress={() => void submit('accept')}
            >
              {t('challenges.accept', { defaultValue: 'Accept invitation' })}
            </Button>
          )}
          <Button
            accessibilityRole="button"
            variant="secondary"
            disabled={mutation.isPending}
            onPress={() => void submit('decline')}
          >
            {t('challenges.decline', { defaultValue: 'Decline' })}
          </Button>
        </>
      )}
      {owner && open && (
        <View className="gap-2">
          <Button
            accessibilityRole="button"
            variant="secondary"
            disabled={mutation.isPending || capacity <= 0}
            onPress={() => {
              mutation.reset();
              setSelected([]);
              setEditor('invite');
            }}
          >
            {labels.invite}
          </Button>
          {challenge.lifecycle === 'upcoming' && (
            <Button
              accessibilityRole="button"
              variant="secondary"
              disabled={mutation.isPending}
              onPress={() => {
                mutation.reset();
                setName(challenge.name);
                setEditor('rename');
              }}
            >
              {labels.rename}
            </Button>
          )}
          <Button
            accessibilityRole="button"
            variant="destructive"
            disabled={mutation.isPending}
            onPress={() => confirm('cancel')}
          >
            {labels.cancel}
          </Button>
        </View>
      )}
      {!owner && challenge.my_membership === 'accepted' && (
        <Button
          accessibilityRole="button"
          variant="destructive"
          disabled={mutation.isPending}
          onPress={() => confirm('leave')}
        >
          {labels.leave}
        </Button>
      )}
      {editor && (
        <View className="gap-4 rounded-2xl bg-surface border border-border-subtle p-4">
          <Text
            accessibilityRole="header"
            className="text-text-primary text-xl font-semibold"
          >
            {labels[editor]}
          </Text>
          {editor === 'rename' ? (
            <FormInput
              accessibilityLabel={t('challenges.name', {
                defaultValue: 'Challenge name',
              })}
              value={name}
              onChangeText={setName}
              maxLength={100}
              editable={!mutation.isPending}
            />
          ) : (
            <ChallengeInvitees
              selected={selected}
              onChange={setSelected}
              excluded={participants.map((p) => p.user_id)}
              capacity={Math.min(1, capacity)}
            />
          )}
          <Button
            accessibilityRole="button"
            disabled={
              mutation.isPending ||
              (editor === 'rename'
                ? !challengeNameSchema.safeParse(name).success
                : selected.length !== 1)
            }
            onPress={() => void submit(editor)}
          >
            {mutation.isPending
              ? t('challenges.saving', { defaultValue: 'Saving…' })
              : labels[editor]}
          </Button>
          <Button
            accessibilityRole="button"
            variant="ghost"
            disabled={mutation.isPending}
            onPress={() => setEditor(null)}
          >
            {t('challenges.keep', { defaultValue: 'Go back' })}
          </Button>
        </View>
      )}
      {mutation.isError && <ChallengeMutationError />}
    </View>
  );
}
