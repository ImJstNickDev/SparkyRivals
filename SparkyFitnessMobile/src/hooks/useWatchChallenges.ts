import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import WatchConnectivity from '../../modules/watch-connectivity';
import {
  challengeListOptions,
  challengeResultsOptions,
} from './challengeQueryOptions';
import { challengeKeys, profileQueryKey } from './queryKeys';
import { fetchProfile } from '../services/api/profileApi';
import { getActiveServerConfigId } from '../services/storage';
import { ApiError } from '../services/api/errors';
import {
  getWatchChallengeSession,
  subscribeWatchChallengeSession,
} from '../services/watchChallengeSession';
import {
  buildWatchChallenges,
  emptyWatchChallenges,
  selectWatchChallenges,
} from '../utils/watchChallenges';

const accessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.statusCode);

/** Uses the same queries as the phone screens. No native writes, polling or
 * direct API client here. A local config id + verified profile bind the cache. */
export function useWatchChallenges(connected: boolean) {
  const client = useQueryClient();
  const session = useSyncExternalStore(
    subscribeWatchChallengeSession,
    getWatchChallengeSession
  );
  const supported =
    WatchConnectivity?.isSupported() === true && WatchConnectivity.isPaired();
  const account = useQuery({
    queryKey: ['watchChallengeAccount', session.revision],
    enabled: supported && !session.blocked,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const configId = await getActiveServerConfigId();
      if (!configId) return null;
      const profile = await client.fetchQuery({
        queryKey: profileQueryKey,
        queryFn: fetchProfile,
        staleTime: 30 * 60_000,
      });
      if (
        session !== getWatchChallengeSession() ||
        configId !== (await getActiveServerConfigId())
      )
        return null;
      return { configId, actor: profile.id, key: `${configId}:${profile.id}` };
    },
  });
  const identity =
    !session.blocked && !accessDenied(account.error) ? account.data : null;
  const actor = identity?.actor ?? '';
  const enabled = supported && connected && !!identity;
  const list = useInfiniteQuery({ ...challengeListOptions(actor), enabled });
  const challenges = useMemo(
    () => list.data?.pages.flatMap((p) => p.challenges) ?? [],
    [list.data]
  );
  const selection = useMemo(
    () => selectWatchChallenges(challenges),
    [challenges]
  );
  const scored = selection.items.filter((c) => c.my_membership === 'accepted');
  const results = useQueries({
    queries: scored.map((c) => ({
      ...challengeResultsOptions(actor, c.id),
      enabled,
    })),
  });
  const snapshot =
    !identity || accessDenied(list.error)
      ? emptyWatchChallenges()
      : buildWatchChallenges({
          accountKey: identity.key,
          actor,
          challenges,
          listUpdatedAt: list.dataUpdatedAt,
          hasMore: list.hasNextPage,
          results: new Map(
            scored.map((c, i) => [
              c.id,
              {
                data: results[i].data,
                dataUpdatedAt: results[i].dataUpdatedAt,
                inaccessible: accessDenied(results[i].error),
              },
            ])
          ),
        });
  // Query observers can rerender without a data change. Stable wire bytes avoid
  // a composed-context push (and its measurement refresh) on each such render.
  const serialized = JSON.stringify(snapshot);
  const stableSnapshot = useMemo(
    () => JSON.parse(serialized) as typeof snapshot,
    [serialized]
  );
  const lastRefresh = useRef(0);
  const refresh = useCallback(() => {
    if (!enabled || Date.now() - lastRefresh.current < 30_000) return;
    lastRefresh.current = Date.now();
    void client.invalidateQueries({ queryKey: challengeKeys.all(actor) });
  }, [enabled, client, actor]);
  return {
    snapshot: stableSnapshot,
    refresh,
    sessionRevision: session.revision,
    configId: identity?.configId,
  };
}
