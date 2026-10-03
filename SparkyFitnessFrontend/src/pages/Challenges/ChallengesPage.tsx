import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import {
  useChallenges,
  useChallengeRefresh,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import {
  ChallengeShell,
  ChallengeLoading,
  ChallengeError,
  ChallengeEmpty,
} from './ChallengeChrome';
import { ChallengeCard } from './ChallengeCard';
import { useChallengeFormat } from './presentation';

export default function ChallengesPage() {
  const query = useChallenges();
  const refresh = useChallengeRefresh();
  const { t, statuses } = useChallengeFormat();
  const challenges = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.challenges) ?? []).map((c) => [
        c.id,
        c,
      ])
    ).values(),
  ];
  const groups = [
    {
      key: 'pending',
      label: t('challenges.invitations', 'Invitations'),
      items: challenges.filter((c) => c.my_membership === 'pending'),
    },
    ...(['active', 'upcoming', 'completed', 'cancelled'] as const).map(
      (key) => ({
        key,
        label: statuses[key],
        items: challenges.filter(
          (c) => c.my_membership !== 'pending' && c.lifecycle === key
        ),
      })
    ),
  ];
  return (
    <ChallengeShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {t('challenges.eyebrow', 'A little friendly competition')}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('challenges.title', 'Challenges')}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {t('challenges.subtitle', 'Small steps. Shared momentum.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void refresh()}
            aria-label={t('challenges.refresh', 'Refresh Challenges')}
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
          </Button>
          <Button asChild>
            <Link to="/challenges/new">
              <Plus aria-hidden className="mr-2 h-4 w-4" />
              {t('challenges.create', 'Create Challenge')}
            </Link>
          </Button>
        </div>
      </header>
      {query.isPending ? (
        <ChallengeLoading />
      ) : query.isError ? (
        <ChallengeError retry={() => void refresh()} />
      ) : !challenges.length ? (
        <ChallengeEmpty />
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((group) => (
            <section key={group.key} className="space-y-4">
              <h2 className="text-xl font-semibold">{group.label}</h2>
              <div className="space-y-4">
                {group.items.map((c, i) => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    featured={group.key === 'active' && i === 0}
                  />
                ))}
              </div>
            </section>
          ))
      )}
      {query.hasNextPage && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              'challenges.moreHistory',
              'Load older Challenges to see more active competitions and history.'
            )}
          </p>
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t('challenges.loadMore', 'Load more')}
          </Button>
        </div>
      )}
    </ChallengeShell>
  );
}
