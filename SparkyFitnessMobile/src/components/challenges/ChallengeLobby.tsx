import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  todayInZone,
  challengeTargetInput,
  challengeTargetSchema,
  suggestedChallengeTarget,
  CHALLENGE_METRIC_UNITS,
  formatChallengeValue,
  type ChallengeDetailResponse,
  type ChallengeParticipantResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '../../hooks/useChallenges';
import { usePreferences } from '../../hooks/usePreferences';
import { fetchDailyGoals } from '../../services/api/goalsApi';
import { goalsQueryKey } from '../../hooks/queryKeys';
import FormInput from '../FormInput';
import Button from '../ui/Button';
import { ChallengeMutationError, useChallengeFormat } from './ChallengeChrome';

export function ChallengeLobby({
  detail,
}: {
  detail: ChallengeDetailResponse;
}) {
  const { challenge, participants } = detail;
  const { actor } = useChallengeIdentity();
  const { t, locale } = useChallengeFormat(
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
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="text-text-primary text-xl font-semibold"
      >
        {lobby
          ? t('challenges.lobby', { defaultValue: 'Waiting for players' })
          : t('challenges.lockedTargets', {
              defaultValue: 'Locked daily targets',
            })}
      </Text>
      <Text className="text-text-secondary">
        {challenge.scoring_mode === 'goal_progress'
          ? t('challenges.progressRules', {
              defaultValue:
                'Each day earns actual ÷ your target × 100 points, without a cap. Points accumulate; equal points tie.',
            })
          : t('challenges.goalDayRules', {
              defaultValue:
                'Each day at or above your target counts once. Equal goal-day totals tie.',
            })}
      </Text>
      {lobby && (
        <Text className="text-text-secondary">
          {t('challenges.lobbyRules', {
            defaultValue:
              'At least two people must join. Pending invitations block the start. Choose your own target, save it and press Ready. Targets lock when everyone is Ready.',
          })}
        </Text>
      )}
      {lobby && (
        <Text className="text-text-secondary">
          {challenge.start_next_day
            ? t('challenges.nextDayHint', {
                defaultValue:
                  'When everyone is Ready, targets lock and scoring starts on the next full day in the Challenge timezone.',
              })
            : t('challenges.immediateHint', {
                defaultValue:
                  'When everyone is Ready, scoring starts immediately. The entire current Challenge-local day counts, including earlier activity.',
              })}
        </Text>
      )}
      {participants.map((p) => (
        <View key={p.user_id} className="gap-1">
          <Text className="text-text-primary">
            {p.display_name} ·{' '}
            {p.target_value == null
              ? '—'
              : formatChallengeValue(
                  p.target_value,
                  CHALLENGE_METRIC_UNITS[challenge.metric],
                  locale
                )}{' '}
            ·{' '}
            {p.status === 'accepted'
              ? p.ready_at
                ? t('challenges.ready', { defaultValue: 'Ready' })
                : t('challenges.notReady', { defaultValue: 'Not ready' })
              : {
                  pending: t('challenges.membership.pending', {
                    defaultValue: 'Pending',
                  }),
                  declined: t('challenges.membership.declined', {
                    defaultValue: 'Declined',
                  }),
                  left: t('challenges.membership.left', {
                    defaultValue: 'Left',
                  }),
                  withdrawn: t('challenges.membership.withdrawn', {
                    defaultValue: 'Withdrawn',
                  }),
                }[p.status]}
          </Text>
          {lobby &&
            actor === challenge.creator_user_id &&
            p.status === 'pending' && (
              <Button
                accessibilityRole="button"
                variant="secondary"
                disabled={mutation.isPending}
                onPress={() =>
                  mutation.mutate({
                    action: 'withdraw',
                    id: challenge.id,
                    userId: p.user_id,
                  })
                }
              >
                {t('challenges.withdraw', {
                  defaultValue: 'Withdraw invitation',
                })}
              </Button>
            )}
        </View>
      ))}
      {lobby &&
        own &&
        (goals.isPending ? (
          <Text className="text-text-secondary">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        ) : (
          <TargetForm
            key={`${actor}:${goalDate}:${own.target_revision}:${own.target_value}`}
            detail={detail}
            own={own}
            suggested={
              goals.data
                ? suggestedChallengeTarget(challenge.metric, goals.data)
                : null
            }
          />
        ))}
      {mutation.isError && <ChallengeMutationError />}
    </View>
  );
}
function TargetForm({
  detail,
  own,
  suggested,
}: {
  detail: ChallengeDetailResponse;
  own: ChallengeParticipantResponse;
  suggested: number | null;
}) {
  const { challenge } = detail;
  const { t } = useChallengeFormat(challenge.metric, challenge.scoring_mode);
  const input = challengeTargetInput(challenge.metric);
  const [value, setValue] = useState(
    own.target_value == null
      ? suggested == null
        ? ''
        : String(suggested / input.factor)
      : String(own.target_value / input.factor)
  );
  const [invalid, setInvalid] = useState(false);
  const mutation = useChallengeMutation();
  const canonical = Number(value) * input.factor;
  const revision = own.target_revision ?? 0;
  const label = t('challenges.dailyTarget', {
    defaultValue: 'Your daily target ({{unit}})',
    unit: input.unit,
  });
  return (
    <View className="gap-3">
      <Text className="text-text-primary">{label}</Text>
      {own.target_value == null && suggested != null && (
        <Text className="text-text-secondary">
          {t('challenges.goalSuggested', {
            defaultValue:
              'Suggested from your personal goal. You can choose a different target for this Challenge.',
          })}
        </Text>
      )}
      <FormInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        editable={!mutation.isPending}
      />
      <Button
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={() => {
          const parsed = challengeTargetSchema.safeParse(canonical);
          setInvalid(!parsed.success);
          if (parsed.success)
            mutation.mutate({
              action: 'target',
              id: challenge.id,
              target: parsed.data,
              revision,
            });
        }}
      >
        {t('challenges.saveTarget', { defaultValue: 'Save target' })}
      </Button>
      <Button
        accessibilityRole="button"
        variant="secondary"
        disabled={
          mutation.isPending ||
          own.target_value == null ||
          canonical !== own.target_value
        }
        onPress={() =>
          mutation.mutate({
            action: 'ready',
            id: challenge.id,
            ready: !own.ready_at,
            revision,
          })
        }
      >
        {own.ready_at
          ? t('challenges.unready', { defaultValue: 'Not ready' })
          : t('challenges.ready', { defaultValue: 'Ready' })}
      </Button>
      {invalid && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('challenges.invalidTarget', {
            defaultValue:
              'Enter a positive target with at most six decimal places in the canonical unit.',
          })}
        </Text>
      )}
      {mutation.isError && <ChallengeMutationError />}
    </View>
  );
}
