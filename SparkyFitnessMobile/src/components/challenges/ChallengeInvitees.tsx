import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  selectChallengeInvitees,
} from '@workspace/shared';
import {
  useChallengeConnections,
  useChallengeIdentity,
} from '../../hooks/useChallenges';
import Icon from '../Icon';
import {
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from './ChallengeChrome';

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
  const accent = useCSSVariable('--color-accent-primary') as string;
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
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="text-text-primary text-lg font-semibold"
      >
        {t('challenges.inviteFriends', {
          defaultValue: 'Invite Family & Friends',
        })}
      </Text>
      <Text className="text-text-secondary">
        {t('challenges.consentHint', {
          defaultValue:
            'Each person chooses whether to join. Only Challenge step data is shared.',
        })}
      </Text>
      {connections.isPending ? (
        <ChallengeLoading />
      ) : connections.isError ? (
        <ChallengeProblem retry={() => void connections.refetch()} />
      ) : !candidates.length ? (
        <Text className="text-text-secondary rounded-xl bg-surface p-4">
          {t('challenges.noConnections', {
            defaultValue:
              'No eligible connections. Manage Family & Friends in web Settings, or create a Challenge and invite them later.',
          })}
        </Text>
      ) : (
        candidates.map((person) => {
          const checked = selected.includes(person.user_id);
          const disabled = !checked && selected.length >= capacity;
          return (
            <Pressable
              key={person.user_id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled }}
              accessibilityLabel={
                person.display_name ||
                t('challenges.participant', { defaultValue: 'Participant' })
              }
              disabled={disabled}
              onPress={() =>
                onChange(
                  checked
                    ? selected.filter((id) => id !== person.user_id)
                    : [...selected, person.user_id]
                )
              }
              className={`min-h-12 flex-row items-center gap-3 rounded-2xl border p-4 ${checked ? 'border-accent-primary bg-surface' : 'border-border-subtle bg-surface'}`}
            >
              <Icon
                name={checked ? 'checkmark-circle' : 'radio-button-off'}
                size={22}
                color={accent}
              />
              <Text className="flex-1 text-text-primary text-base">
                {person.display_name ||
                  t('challenges.participant', { defaultValue: 'Participant' })}
              </Text>
            </Pressable>
          );
        })
      )}
      {capacity <= 0 && (
        <Text className="text-text-secondary">
          {t('challenges.capacity', {
            defaultValue: 'This Challenge has reached its participant limit.',
          })}
        </Text>
      )}
    </View>
  );
}
