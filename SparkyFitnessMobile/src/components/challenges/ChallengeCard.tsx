import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { ChallengeMetric, ChallengeResponse } from '@workspace/shared';
import Icon, { type IconName } from '../Icon';
import { challengeTypeText } from '@workspace/shared';
import { useChallengeFormat } from './ChallengeChrome';

export const challengeIcon: Record<ChallengeMetric, IconName> = {
  steps: 'exercise-walking',
  distance: 'location',
  active_calories: 'flame',
  workout_time: 'timer',
  workout_calories: 'exercise',
  workout_distance: 'exercise-running',
  hydration: 'water',
};

/** A list object, without a per-row leaderboard request. */
export function ChallengeCard({
  challenge,
  onPress,
}: {
  challenge: ChallengeResponse;
  onPress: () => void;
}) {
  const { t, day, statuses } = useChallengeFormat();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const secondary = useCSSVariable('--color-text-secondary') as string;
  const pending = challenge.my_membership === 'pending';
  return (
    <Pressable
      testID={`challenge-card-${challenge.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('challenges.openNamed', {
        defaultValue: 'Open {{name}}',
        name: challenge.name,
      })}
      onPress={onPress}
      className="flex-row items-center gap-3 py-4 border-b border-border-subtle"
      style={{ minHeight: 72 }}
    >
      <Icon name={challengeIcon[challenge.metric]} size={24} color={accent} />
      <View className="flex-1 gap-1">
        <Text className="text-text-primary text-base font-semibold">
          {challenge.name}
        </Text>
        <Text className="text-text-secondary text-sm">
          {challengeTypeText(t, challenge.metric, challenge.scoring_mode)}
        </Text>
        <Text className="text-text-secondary text-sm">
          {pending
            ? t('challenges.reviewInvitation', {
                defaultValue: 'Review invitation',
              })
            : challenge.lifecycle === 'lobby' && challenge.my_ready
              ? t('challenges.ux.readyWaiting', {
                  defaultValue: "You're ready · Waiting for others",
                })
              : challenge.lifecycle === 'upcoming' && challenge.start_date
                ? t('challenges.ux.startsOn', {
                    defaultValue: 'Starts {{date}}',
                    date: day(challenge.start_date),
                  })
                : challenge.lifecycle === 'active' && challenge.end_date
                  ? t('challenges.ux.endsOn', {
                      defaultValue: 'Ends {{date}}',
                      date: day(challenge.end_date),
                    })
                  : statuses[challenge.lifecycle]}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={secondary} />
    </Pressable>
  );
}
