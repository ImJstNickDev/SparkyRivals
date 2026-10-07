import {
  challengeReadBlocked,
  challengeMetricText,
  challengeTypeText,
  selectChallengeInvitees,
} from '@workspace/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useChallengeConnections,
  useChallengeDetail,
  useChallengeIdentity,
  useChallengeResults,
  useChallengeScreenRefresh,
} from '../hooks/useChallenges';
import { useScreenHeader } from '../hooks/useScreenHeader';
import Button from '../components/ui/Button';
import Icon from '../components/Icon';
import {
  ChallengeFrame,
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from '../components/challenges/ChallengeChrome';
import {
  ChallengeDailyHistory,
  ChallengeResultFacts,
} from '../components/challenges/ChallengeScores';
import {
  ChallengeDates,
  ChallengeUpdated,
} from '../components/challenges/ChallengeTiming';
import { ChallengeResultSummary } from '../components/challenges/ChallengeResultSummary';
import { challengeIcon } from '../components/challenges/ChallengeCard';
import { ChallengeLobby } from '../components/challenges/ChallengeLobby';
import { ChallengeActions } from '../components/challenges/ChallengeActions';

export default function ChallengeDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'ChallengeDetail'>) {
  const detail = useChallengeDetail(route.params.id);
  const results = useChallengeResults(detail.data?.challenge);
  const identity = useChallengeIdentity();
  const connections = useChallengeConnections();
  const refresh = useChallengeScreenRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { t, day, statuses } = useChallengeFormat();
  const accent = useCSSVariable('--color-accent-primary') as string;
  const header = useScreenHeader({
    title: t('challenges.title', { defaultValue: 'Challenges' }),
    left: { kind: 'back' },
  });
  const challenge = detail.data?.challenge;
  const pending = challenge?.my_membership === 'pending';
  const inviter = selectChallengeInvitees(
    connections.data ?? [],
    identity.actor
  ).find((p) => p.user_id === challenge?.creator_user_id)?.display_name;
  const hasResults =
    challenge?.lifecycle === 'active' || challenge?.lifecycle === 'completed';
  return (
    <ChallengeFrame
      header={header}
      keyboard
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void refresh().finally(() => setRefreshing(false));
      }}
    >
      {identity.isError ||
      challengeReadBlocked(detail.error) ||
      challengeReadBlocked(results.error) ? (
        <ChallengeProblem
          error={detail.error ?? results.error}
          retry={() => void refresh()}
        />
      ) : detail.isPending ? (
        <ChallengeLoading />
      ) : !challenge || !detail.data ? (
        <ChallengeProblem
          error={detail.error}
          retry={() => void detail.refetch()}
        />
      ) : (
        <>
          {detail.isError && (
            <ChallengeProblem
              error={detail.error}
              retry={() => void detail.refetch()}
            />
          )}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon
                name={challengeIcon[challenge.metric]}
                color={accent}
                size={22}
              />
              <Text className="text-text-secondary flex-1">
                {challengeTypeText(t, challenge.metric, challenge.scoring_mode)}
              </Text>
            </View>
            <Text
              accessibilityRole="header"
              className="text-text-primary text-2xl font-bold"
            >
              {challenge.name}
            </Text>
            {!pending && !['active', 'lobby'].includes(challenge.lifecycle) && (
              <Text className="text-text-secondary">
                {statuses[challenge.lifecycle]}
              </Text>
            )}
            <ChallengeDates challenge={challenge} />
          </View>
          {pending ? (
            <>
              {inviter && (
                <Text className="text-text-primary">
                  {t('challenges.invitedBy', {
                    defaultValue: 'Invited by {{name}}',
                    name: inviter,
                  })}
                </Text>
              )}
              <View className="gap-2 py-2">
                <Text
                  accessibilityRole="header"
                  className="text-text-primary font-semibold"
                >
                  {t('challenges.ux.sharingTitle', {
                    defaultValue: 'What you share',
                  })}
                </Text>
                <View className="flex-row flex-wrap gap-4">
                  <View className="flex-row items-center gap-2">
                    <Icon name="checkmark" size={18} color={accent} />
                    <Icon
                      name={challengeIcon[challenge.metric]}
                      size={20}
                      color={accent}
                    />
                    <Text className="text-text-primary">
                      {challengeMetricText(t, challenge.metric)}
                    </Text>
                  </View>
                  {challenge.scoring_mode !== 'sum' && (
                    <View className="flex-row items-center gap-2">
                      <Icon name="checkmark" size={18} color={accent} />
                      <Text className="text-text-primary">
                        {t('challenges.ux.targetLabel', {
                          defaultValue: 'Daily target',
                        })}
                      </Text>
                    </View>
                  )}
                  {challenge.metric.startsWith('workout_') && (
                    <View className="flex-row items-center gap-2">
                      <Icon name="checkmark" size={18} color={accent} />
                      <Text className="text-text-primary">
                        {t('challenges.ux.sessionsLabel', {
                          defaultValue: 'Session count',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-text-secondary text-xs">
                  {t('challenges.ux.otherDataPrivate', {
                    defaultValue: 'Other health data stays private.',
                  })}
                </Text>
              </View>
              <ChallengeActions
                key={challenge.id}
                detail={detail.data}
                onDepart={() => navigation.replace('Challenges')}
              />
            </>
          ) : (
            <>
              {challenge.lifecycle === 'lobby' && (
                <ChallengeLobby detail={detail.data} />
              )}
              {challenge.lifecycle === 'upcoming' && (
                <View className="gap-3 py-4">
                  <Text className="text-text-primary text-xl font-semibold">
                    {t('challenges.ux.startsOn', {
                      defaultValue: 'Starts {{date}}',
                      date: day(challenge.start_date),
                    })}
                  </Text>
                  {challenge.scoring_mode !== 'sum' && (
                    <Text className="text-text-secondary">
                      {t('challenges.ux.targetsLocked', {
                        defaultValue:
                          'Targets are locked. Everything is ready.',
                      })}
                    </Text>
                  )}
                </View>
              )}
              {hasResults && (
                <>
                  {results.data ? (
                    <ChallengeResultSummary
                      result={results.data}
                      actor={identity.actor}
                    />
                  ) : results.isError ? (
                    <ChallengeProblem
                      error={results.error}
                      retry={() => void results.refetch()}
                    />
                  ) : (
                    <ChallengeLoading />
                  )}
                  {results.data && (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showHistory }}
                        onPress={() => setShowHistory(!showHistory)}
                        className="self-start flex-row items-center gap-2 min-h-12 px-2"
                      >
                        <Icon name="calendar" size={18} color={accent} />
                        <Text className="text-accent-primary text-sm">
                          {t('challenges.ux.dailyHistory', {
                            defaultValue: 'Daily history',
                          })}
                        </Text>
                      </Pressable>
                      {showHistory && (
                        <ChallengeDailyHistory
                          result={results.data}
                          actor={identity.actor}
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {challenge.lifecycle === 'completed' && (
                <Text className="text-text-secondary text-sm">
                  {t('challenges.aggregateReconciles', {
                    defaultValue:
                      'Results can change when canonical data arrives late, is corrected or deleted. Locked targets stay unchanged.',
                  })}
                </Text>
              )}
              {challenge.lifecycle === 'cancelled' && (
                <Text className="text-text-secondary">
                  {t('challenges.cancelledAggregate', {
                    defaultValue:
                      'Cancelled. Challenge data sharing has stopped.',
                  })}
                </Text>
              )}
              {['completed', 'cancelled'].includes(challenge.lifecycle) && (
                <Button
                  onPress={() =>
                    navigation.navigate('CreateChallenge', {
                      rematchId: challenge.id,
                    })
                  }
                >
                  {t('challenges.rematch', { defaultValue: 'Rematch' })}
                </Button>
              )}
              <Button
                variant="ghost"
                accessibilityState={{ expanded: showDetails }}
                onPress={() => setShowDetails(!showDetails)}
              >
                {t('challenges.ux.detailsActions', {
                  defaultValue: 'Details and actions',
                })}
              </Button>
              {showDetails && (
                <View className="gap-4">
                  <Text className="text-text-secondary">
                    {challenge.timezone}
                  </Text>
                  {results.data && (
                    <ChallengeResultFacts result={results.data} />
                  )}
                  {challenge.scoring_mode !== 'sum' &&
                    challenge.lifecycle !== 'lobby' && (
                      <ChallengeLobby detail={detail.data} />
                    )}
                  <ChallengeActions
                    key={challenge.id}
                    detail={detail.data}
                    onDepart={() => navigation.replace('Challenges')}
                  />
                </View>
              )}
              {hasResults && results.data && (
                <ChallengeUpdated timestamp={results.data.calculated_at} />
              )}
            </>
          )}
        </>
      )}
    </ChallengeFrame>
  );
}
