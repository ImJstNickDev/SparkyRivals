import { Text, View } from 'react-native';
import { useState } from 'react';
import type { ChallengeResponse } from '@workspace/shared';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useChallengeIdentity,
  useChallenges,
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
import { ChallengeCard } from '../components/challenges/ChallengeCard';

export default function ChallengesScreen({
  navigation,
}: RootStackScreenProps<'Challenges'>) {
  const { t, statuses } = useChallengeFormat();
  const identity = useChallengeIdentity();
  const query = useChallenges();
  const refresh = useChallengeScreenRefresh();
  const [refreshing, setRefreshing] = useState(false);
  const header = useScreenHeader({
    title: t('challenges.title', { defaultValue: 'Challenges' }),
    left: { kind: 'back' },
  });
  const challenges = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.challenges) ?? []).map((c) => [
        c.id,
        c,
      ])
    ).values(),
  ];
  const sections = [
    {
      title: t('challenges.invitations', { defaultValue: 'Invitations' }),
      items: challenges.filter((c) => c.my_membership === 'pending'),
    },
    ...(['active', 'lobby', 'upcoming', 'completed', 'cancelled'] as const).map(
      (state) => ({
        title: statuses[state],
        items: challenges.filter(
          (c) => c.my_membership !== 'pending' && c.lifecycle === state
        ),
      })
    ),
  ];
  const open = (c: ChallengeResponse) =>
    navigation.navigate('ChallengeDetail', { id: c.id });
  return (
    <ChallengeFrame
      header={header}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void refresh().finally(() => setRefreshing(false));
      }}
    >
      <Text className="text-text-primary text-3xl font-bold">
        {t('challenges.hubTitle', { defaultValue: 'Every step, together.' })}
      </Text>
      <Text className="text-text-secondary text-base">
        {t('challenges.hubDescription', {
          defaultValue:
            'A little friendly competition. A little more movement.',
        })}
      </Text>
      {identity.enabled && (
        <Button
          accessibilityRole="button"
          onPress={() => navigation.navigate('CreateChallenge')}
        >
          {t('challenges.create', { defaultValue: 'Create Challenge' })}
        </Button>
      )}
      {identity.isError ? (
        <ChallengeProblem retry={() => void identity.refetch()} />
      ) : identity.isLoading || query.isPending ? (
        <ChallengeLoading />
      ) : query.isError ? (
        <ChallengeProblem retry={() => void query.refetch()} />
      ) : !challenges.length ? (
        <View className="rounded-3xl bg-surface p-6 gap-3">
          <Text className="text-text-primary text-xl font-semibold">
            {t('challenges.emptyTitle', {
              defaultValue: 'Go a little further, together',
            })}
          </Text>
          <Text className="text-text-secondary">
            {t('challenges.emptyDescription', {
              defaultValue:
                'Turn everyday steps into friendly competition. Start with a day or make it a week.',
            })}
          </Text>
        </View>
      ) : (
        sections.map(
          (section) =>
            section.items.length > 0 && (
              <View key={section.title} className="gap-4">
                <Text
                  accessibilityRole="header"
                  className="text-text-primary text-xl font-semibold"
                >
                  {section.title}
                </Text>
                {section.items.map((c, i) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    featured={
                      c.lifecycle === 'active' &&
                      i === 0 &&
                      c.my_membership === 'accepted'
                    }
                    onPress={() => open(c)}
                  />
                ))}
              </View>
            )
        )
      )}
      {query.hasNextPage && (
        <Button
          accessibilityRole="button"
          variant="secondary"
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {t('challenges.loadMore', { defaultValue: 'Load more' })}
        </Button>
      )}
    </ChallengeFrame>
  );
}
