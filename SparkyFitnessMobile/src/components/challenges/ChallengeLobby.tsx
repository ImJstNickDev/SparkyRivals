import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  todayInZone,
  suggestedChallengeTarget,
  CHALLENGE_METRIC_UNITS,
  type ChallengeDetailResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '../../hooks/useChallenges';
import { usePreferences } from '../../hooks/usePreferences';
import { fetchDailyGoals } from '../../services/api/goalsApi';
import { goalsQueryKey } from '../../hooks/queryKeys';
import { ChallengeTargetForm } from './ChallengeTargetForm';
import { ChallengeParticipantRow } from './ChallengeParticipantRow';
import { ChallengeMutationError, useChallengeFormat } from './ChallengeChrome';

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
  const mutation = useChallengeMutation();
  const lobby = challenge.lifecycle === 'lobby';
  const { preferences } = usePreferences({ enabled: lobby });
  const goalDate = todayInZone(preferences?.timezone || challenge.timezone);
  const goals = useQuery({
    queryKey: goalsQueryKey(goalDate),
    queryFn: () => fetchDailyGoals(goalDate),
    enabled: lobby,
  });
  const own = participants.find((p) => p.user_id === actor);
  return (
    <View className="gap-5">
      {lobby && own && !goals.isPending && (
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
      )}
      <View className="gap-1">
        <Text
          accessibilityRole="header"
          className="text-text-primary text-lg font-semibold"
        >
          {lobby
            ? t('challenges.participants', { defaultValue: 'Participants' })
            : t('challenges.lockedTargets', {
                defaultValue: 'Locked daily targets',
              })}
        </Text>
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
              <ChallengeParticipantRow
                key={p.user_id}
                participant={p}
                status={status}
                removable={removable}
                pending={mutation.isPending}
                onRemove={() =>
                  mutation.mutate({
                    action:
                      p.status === 'pending' ? 'withdraw' : 'removeParticipant',
                    id: challenge.id,
                    userId: p.user_id,
                  })
                }
              />
            );
          })}
      </View>
      {mutation.isError && <ChallengeMutationError />}
    </View>
  );
}
