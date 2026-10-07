import { Text, View } from 'react-native';
import { useState } from 'react';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useChallengeIdentity,
  useChallenges,
  useChallengeScreenRefresh,
} from '../hooks/useChallenges';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useNavigationActionGuard } from '../hooks/useNavigationActionGuard';
import Button from '../components/ui/Button';
import SegmentedControl from '../components/SegmentedControl';
import {
  ChallengeFrame,
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from '../components/challenges/ChallengeChrome';
import { ChallengeCard } from '../components/challenges/ChallengeCard';

type HubView = 'mine' | 'invitations' | 'history';
export default function ChallengesScreen({
  navigation,
}: RootStackScreenProps<'Challenges'>) {
  const { t, statuses } = useChallengeFormat();
  const identity = useChallengeIdentity();
  const [view, setView] = useState<HubView>('mine');
  const query = useChallenges(view);
  const refresh = useChallengeScreenRefresh();
  const { runNavigationAction } = useNavigationActionGuard(navigation);
  const [refreshing, setRefreshing] = useState(false);
  const header = useScreenHeader({
    title: t('challenges.title', { defaultValue: 'Challenges' }),
    left: { kind: 'back' },
    right: {
      kind: 'primary',
      label: t('challenges.ux.create', { defaultValue: 'Create' }),
      disabled: !identity.enabled,
      onPress: () =>
        runNavigationAction(() => navigation.navigate('CreateChallenge')),
    },
  });
  const challenges = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.challenges) ?? []).map((c) => [
        c.id,
        c,
      ])
    ).values(),
  ];
  const ordered =
    view === 'mine'
      ? (['active', 'lobby', 'upcoming'] as const).flatMap((state) =>
          challenges.filter((challenge) => challenge.lifecycle === state)
        )
      : challenges;
  const empty = {
    mine: t('challenges.ux.emptyMine', {
      defaultValue: 'Your Challenges will appear here.',
    }),
    invitations: t('challenges.ux.emptyInvitations', {
      defaultValue: 'No invitations to review.',
    }),
    history: t('challenges.ux.emptyHistory', {
      defaultValue: 'Completed and cancelled Challenges will appear here.',
    }),
  };
  return (
    <ChallengeFrame
      header={header}
      list={{
        key: `${identity.actor}:${view}`,
        data: identity.isError || !identity.enabled ? [] : ordered,
        renderItem: ({ item: challenge, index }) => (
          <View>
            {view === 'mine' &&
              (index === 0 ||
                ordered[index - 1]?.lifecycle !== challenge.lifecycle) && (
                <Text
                  accessibilityRole="header"
                  className="text-text-secondary font-semibold pt-5 pb-1"
                >
                  {statuses[challenge.lifecycle]}
                </Text>
              )}
            <ChallengeCard
              challenge={challenge}
              onPress={() =>
                runNavigationAction(() =>
                  navigation.navigate('ChallengeDetail', { id: challenge.id })
                )
              }
            />
          </View>
        ),
        footer: query.hasNextPage ? (
          <Button
            variant="secondary"
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
          >
            {t('challenges.loadMore', { defaultValue: 'Load more' })}
          </Button>
        ) : undefined,
      }}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void refresh().finally(() => setRefreshing(false));
      }}
    >
      <SegmentedControl
        segments={[
          {
            key: 'mine',
            label: t('challenges.ux.mine', { defaultValue: 'My Challenges' }),
          },
          {
            key: 'invitations',
            label: t('challenges.invitations', { defaultValue: 'Invitations' }),
          },
          {
            key: 'history',
            label: t('challenges.ux.history', { defaultValue: 'History' }),
          },
        ]}
        activeKey={view}
        onSelect={setView}
      />
      {identity.isError ? (
        <ChallengeProblem retry={() => void identity.refetch()} />
      ) : identity.isLoading || query.isPending ? (
        <ChallengeLoading />
      ) : (
        <>
          {query.isError && (
            <ChallengeProblem retry={() => void query.refetch()} />
          )}
          {!query.isError && !challenges.length && (
            <Text className="text-text-secondary text-base py-8">
              {empty[view]}
            </Text>
          )}
        </>
      )}
    </ChallengeFrame>
  );
}
