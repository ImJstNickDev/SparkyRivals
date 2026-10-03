import { useState } from 'react';
import { Text, View } from 'react-native';
import { selectChallengeInvitees } from '@workspace/shared';
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
import {
  ChallengeFrame,
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from '../components/challenges/ChallengeChrome';
import {
  ChallengeScores,
  ChallengeDailyHistory,
} from '../components/challenges/ChallengeScores';
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
  const [showMembers, setShowMembers] = useState(false);
  const { t, day, number, statuses, locale } = useChallengeFormat();
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
  return (
    <ChallengeFrame
      header={header}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void refresh().finally(() => setRefreshing(false));
      }}
    >
      {identity.isError ? (
        <ChallengeProblem retry={() => void identity.refetch()} />
      ) : detail.isPending ? (
        <ChallengeLoading />
      ) : detail.isError || !challenge || !detail.data ? (
        <ChallengeProblem retry={() => void detail.refetch()} />
      ) : (
        <>
          <View className="gap-3">
            <Text className="text-text-secondary">
              {statuses[challenge.lifecycle]}
            </Text>
            <Text
              accessibilityRole="header"
              className="text-text-primary text-3xl font-bold"
            >
              {challenge.name}
            </Text>
            <Text className="text-text-secondary">
              {day(challenge.start_date)} – {day(challenge.end_date)} ·{' '}
              {challenge.timezone}
            </Text>
            <Text className="text-text-primary font-semibold">
              {t('challenges.rules', {
                defaultValue: 'Steps · Highest total wins',
              })}
            </Text>
            {challenge.lifecycle === 'active' && (
              <>
                <Text className="text-text-primary">
                  {t('challenges.dayProgress', {
                    defaultValue:
                      'Day {{current}} of {{total}} · {{remaining}} days left',
                    current:
                      challenge.progress.current_day === null
                        ? '—'
                        : number(challenge.progress.current_day),
                    count: challenge.progress.days_remaining,
                    total: number(challenge.progress.total_days),
                    remaining: number(challenge.progress.days_remaining),
                  })}
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={t('challenges.dateProgress', {
                    defaultValue: 'Challenge time elapsed',
                  })}
                  accessibilityValue={{
                    min: 0,
                    max: challenge.progress.total_days,
                    now: challenge.progress.elapsed_days,
                  }}
                  className="h-2 rounded-full bg-raised overflow-hidden"
                >
                  <View
                    className="h-full bg-accent-primary"
                    style={{
                      width: `${(challenge.progress.elapsed_days / challenge.progress.total_days) * 100}%`,
                    }}
                  />
                </View>
              </>
            )}
          </View>
          {pending && (
            <View className="rounded-3xl bg-surface p-5 gap-3">
              <Text
                accessibilityRole="header"
                className="text-text-primary text-xl font-semibold"
              >
                {t('challenges.invitation', { defaultValue: 'Invitation' })}
              </Text>
              {inviter && (
                <Text className="text-text-primary">
                  {t('challenges.invitedBy', {
                    defaultValue: 'Invited by {{name}}',
                    name: inviter,
                  })}
                </Text>
              )}
              <Text className="text-text-secondary">
                {t('challenges.acceptPrivacy', {
                  defaultValue:
                    'Accept to share your daily step totals for the whole Challenge date range, including earlier days. Other health data stays private.',
                })}
              </Text>
              <Text className="text-text-secondary">
                {challenge.lifecycle === 'completed' ||
                challenge.lifecycle === 'cancelled'
                  ? t('challenges.invitationClosed', {
                      defaultValue:
                        'This Challenge is closed. You can dismiss the invitation.',
                    })
                  : t('challenges.noScoresBeforeAccept', {
                      defaultValue: 'Scores are visible after you accept.',
                    })}
              </Text>
            </View>
          )}
          {challenge.lifecycle === 'cancelled' ? (
            <Text className="rounded-2xl bg-surface p-5 text-text-secondary">
              {t('challenges.cancelledHint', {
                defaultValue: 'Cancelled. Step sharing has stopped.',
              })}
            </Text>
          ) : (
            !pending && (
              <>
                {challenge.lifecycle === 'completed' && (
                  <View className="gap-2">
                    <Text
                      accessibilityRole="header"
                      className="text-text-primary text-xl font-semibold"
                    >
                      {t('challenges.currentResults', {
                        defaultValue: 'Current results',
                      })}
                    </Text>
                    <Text className="text-text-secondary">
                      {t('challenges.reconciles', {
                        defaultValue:
                          'Results can change when step data arrives late or is corrected.',
                      })}
                    </Text>
                  </View>
                )}
                {results.isError ? (
                  <ChallengeProblem retry={() => void results.refetch()} />
                ) : results.data ? (
                  <>
                    <ChallengeScores
                      result={results.data}
                      actor={identity.actor}
                    />
                    <ChallengeDailyHistory
                      key={challenge.id}
                      result={results.data}
                      actor={identity.actor}
                    />
                    <Text className="text-text-secondary text-xs">
                      {t('challenges.checkedAt', {
                        defaultValue: 'Results refreshed {{time}}',
                        time: new Date(
                          results.data.calculated_at
                        ).toLocaleString(locale),
                      })}
                    </Text>
                  </>
                ) : (
                  <ChallengeLoading />
                )}
              </>
            )
          )}
          <ChallengeActions
            key={challenge.id}
            detail={detail.data}
            onDepart={() => navigation.replace('Challenges')}
          />
          {!pending && (
            <>
              <Button
                accessibilityRole="button"
                accessibilityState={{ expanded: showMembers }}
                variant="secondary"
                onPress={() => setShowMembers(!showMembers)}
              >
                {t('challenges.participants', { defaultValue: 'Participants' })}
              </Button>
              {showMembers &&
                detail.data.participants.map((p) => (
                  <View
                    key={p.user_id}
                    className="flex-row flex-wrap justify-between gap-2"
                  >
                    <Text className="text-text-primary">{p.display_name}</Text>
                    <Text className="text-text-secondary">
                      {p.status === 'accepted'
                        ? t('challenges.accepted', { defaultValue: 'Joined' })
                        : p.status === 'pending'
                          ? t('challenges.pending', { defaultValue: 'Invited' })
                          : p.status === 'left'
                            ? t('challenges.left', { defaultValue: 'Left' })
                            : t('challenges.declined', {
                                defaultValue: 'Declined',
                              })}
                    </Text>
                  </View>
                ))}
            </>
          )}
        </>
      )}
    </ChallengeFrame>
  );
}
