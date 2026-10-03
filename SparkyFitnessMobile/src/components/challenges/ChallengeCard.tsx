import { Text, View } from 'react-native';
import type { ChallengeResponse } from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeResults,
} from '../../hooks/useChallenges';
import Button from '../ui/Button';
import {
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from './ChallengeChrome';
import { ChallengeScores } from './ChallengeScores';

export function ChallengeCard({
  challenge,
  onPress,
  featured = false,
}: {
  challenge: ChallengeResponse;
  onPress: () => void;
  featured?: boolean;
}) {
  const { t, day, number, statuses, rules } = useChallengeFormat(
    challenge.metric
  );
  const { actor } = useChallengeIdentity();
  const result = useChallengeResults(challenge);
  const pending = challenge.my_membership === 'pending';
  const cancelled = challenge.lifecycle === 'cancelled';
  return (
    <View
      testID={`challenge-card-${challenge.id}`}
      className={`gap-4 rounded-3xl border p-5 ${featured ? 'bg-accent-primary/5 border-accent-primary' : 'bg-surface border-border-subtle'}`}
    >
      <Text className="text-text-secondary text-sm">
        {pending
          ? t('challenges.invitation', { defaultValue: 'Invitation' })
          : statuses[challenge.lifecycle]}
      </Text>
      <Text className="text-text-secondary text-sm">{rules}</Text>
      <Text
        accessibilityRole="header"
        className="text-text-primary text-2xl font-bold"
      >
        {challenge.name}
      </Text>
      <Text className="text-text-secondary">
        {day(challenge.start_date)} – {day(challenge.end_date)}
      </Text>
      {challenge.lifecycle === 'active' && (
        <Text className="text-text-primary">
          {t('challenges.daysLeft', {
            defaultValue: '{{days}} days left',
            count: challenge.progress.days_remaining,
            number: number(challenge.progress.days_remaining),
          })}
        </Text>
      )}
      {pending ? (
        <Text className="text-text-secondary">
          {t('challenges.noScoresBeforeAccept', {
            defaultValue: 'Scores are visible after you accept.',
          })}
        </Text>
      ) : cancelled ? (
        <Text className="text-text-secondary">
          {challenge.metric === 'workout_time'
            ? t('challenges.workoutCancelledHint', {
                defaultValue: 'Cancelled. Workout time sharing has stopped.',
              })
            : t('challenges.cancelledHint', {
                defaultValue: 'Cancelled. Step sharing has stopped.',
              })}
        </Text>
      ) : result.isError ? (
        <ChallengeProblem retry={() => void result.refetch()} />
      ) : result.data ? (
        <ChallengeScores result={result.data} actor={actor} compact />
      ) : (
        <ChallengeLoading />
      )}
      <Button
        accessibilityRole="button"
        accessibilityLabel={t('challenges.openNamed', {
          defaultValue: 'Open {{name}}',
          name: challenge.name,
        })}
        variant={featured || pending ? 'primary' : 'secondary'}
        onPress={onPress}
      >
        {pending
          ? t('challenges.reviewInvitation', {
              defaultValue: 'Review invitation',
            })
          : t('challenges.view', { defaultValue: 'View Challenge' })}
      </Button>
    </View>
  );
}
