import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import {
  useChallenges,
  useChallengeRefresh,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ChallengeShell,
  ChallengeLoading,
  ChallengeError,
} from './ChallengeChrome';
import { ChallengeCard } from './ChallengeCard';
import { useChallengeFormat } from './presentation';

export default function ChallengesPage() {
  const [search, setSearch] = useSearchParams();
  const requested = search.get('view');
  const view =
    requested === 'invitations' || requested === 'history' ? requested : 'mine';
  const query = useChallenges(view);
  const refresh = useChallengeRefresh();
  const { t, statuses } = useChallengeFormat();
  const challenges = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.challenges) ?? []).map(
        (challenge) => [challenge.id, challenge]
      )
    ).values(),
  ];
  const groups =
    view === 'mine'
      ? (['active', 'lobby', 'upcoming'] as const).map((key) => ({
          key,
          label: statuses[key],
          items: challenges.filter((challenge) => challenge.lifecycle === key),
        }))
      : [{ key: view, label: '', items: challenges }];
  const labels = {
    mine: t('challenges.ux.mine', { defaultValue: 'My Challenges' }),
    invitations: t('challenges.invitations', { defaultValue: 'Invitations' }),
    history: t('challenges.ux.history', { defaultValue: 'History' }),
  };
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
    <ChallengeShell>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('challenges.title', { defaultValue: 'Challenges' })}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={query.isFetching}
            onClick={() => void refresh()}
            aria-label={t('challenges.refresh', {
              defaultValue: 'Refresh Challenges',
            })}
          >
            <RefreshCw aria-hidden className="h-4 w-4" />
          </Button>
          <Button asChild>
            <Link to="/challenges/new">
              <Plus aria-hidden className="mr-2 h-4 w-4" />
              {t('challenges.ux.create', { defaultValue: 'Create' })}
            </Link>
          </Button>
        </div>
      </header>
      <Tabs
        value={view}
        onValueChange={(next) => {
          if (next === 'mine' || next === 'invitations' || next === 'history')
            setSearch({ view: next });
        }}
      >
        <TabsList className="w-full sm:w-auto">
          {(['mine', 'invitations', 'history'] as const).map((key) => (
            <TabsTrigger
              className="min-h-11 whitespace-normal text-center"
              key={key}
              value={key}
            >
              {labels[key]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={view} className="mt-5 space-y-5">
          {query.isError && <ChallengeError retry={() => void refresh()} />}
          {query.isPending ? (
            <ChallengeLoading />
          ) : !challenges.length && !query.isError ? (
            <p className="py-12 text-center text-muted-foreground">
              {empty[view]}
            </p>
          ) : (
            groups
              .filter((group) => group.items.length)
              .map((group) => (
                <section key={group.key} className="space-y-2">
                  {group.label && (
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {group.label}
                    </h2>
                  )}
                  <ul className="divide-y">
                    {group.items.map((challenge) => (
                      <li key={challenge.id}>
                        <ChallengeCard challenge={challenge} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
          )}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('challenges.loadMore', { defaultValue: 'Load more' })}
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </ChallengeShell>
  );
}
