import { usePreferences } from './usePreferences';
import type { CompanionChallengeSnapshot } from '../types/companionChallenges';
import type { ChallengeResponse } from '@workspace/shared';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  challengeListOptions,
  challengeResultsOptions,
} from './challengeQueryOptions';
import { challengeKeys, profileQueryKey } from './queryKeys';
import { fetchProfile } from '../services/api/profileApi';
import { getActiveServerConfigId } from '../services/storage';
import { ApiError } from '../services/api/errors';
import {
  getCompanionChallengeSession,
  subscribeCompanionChallengeSession,
} from '../services/companionChallengeSession';
import {
  buildCompanionChallenges,
  emptyCompanionChallenges,
  selectCompanionChallenges,
} from '../utils/companionChallenges';

const accessDenied = (error: unknown) =>
  error instanceof ApiError && [401, 403, 404].includes(error.statusCode);

/** Uses the same queries as the phone screens. No native writes, polling or
 * direct API client here. A local config id + verified profile bind the cache. */
export function useCompanionChallenges(connected: boolean, supported: boolean) {
  const client = useQueryClient();
  const session = useSyncExternalStore(
    subscribeCompanionChallengeSession,
    getCompanionChallengeSession
  );
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
        session !== getCompanionChallengeSession() ||
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
  const { preferences } = usePreferences({ enabled });
  const list = useInfiniteQuery({ ...challengeListOptions(actor), enabled });
  const challenges = useMemo(
    () => list.data?.pages.flatMap((p) => p.challenges) ?? [],
    [list.data]
  );
  const selection = useMemo(
    () => selectCompanionChallenges(challenges),
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
    !identity ||
    accessDenied(list.error) ||
    results.some(
      (result) =>
        result.error instanceof ApiError && result.error.statusCode === 401
    )
      ? emptyCompanionChallenges()
      : buildCompanionChallenges({
          accountKey: identity.key,
          displayPreferences: {
            distance: preferences?.default_distance_unit,
            energy: preferences?.energy_unit,
            water: preferences?.water_display_unit,
          },
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
  const lastRefresh = useRef(0);
  const refetchAccount = account.refetch;
  const refresh = useCallback(() => {
    if (
      !supported ||
      !connected ||
      session.blocked ||
      Date.now() - lastRefresh.current < 30_000
    )
      return;
    lastRefresh.current = Date.now();
    if (!identity) void refetchAccount();
    else
      void client.invalidateQueries(
        { queryKey: challengeKeys.all(actor) },
        { cancelRefetch: false }
      );
  }, [
    supported,
    connected,
    session.blocked,
    identity,
    refetchAccount,
    client,
    actor,
  ]);
  // Serialize the projections together after reading all observer metadata.
  const serialized = JSON.stringify({
    snapshot,
    observation: {
      challenges,
      freshList: list.isFetchedAfterMount && list.isSuccess && !list.isFetching,
      freshResultIds: scored
        .filter(
          (_, i) =>
            results[i].isFetchedAfterMount &&
            results[i].isSuccess &&
            !results[i].isFetching
        )
        .map((c) => c.id),
    },
  });
  const projected = useMemo(
    () =>
      JSON.parse(serialized) as {
        snapshot: CompanionChallengeSnapshot;
        observation: {
          challenges: ChallengeResponse[];
          freshList: boolean;
          freshResultIds: string[];
        };
      },
    [serialized]
  );
  return {
    observation: projected.observation,
    snapshot: projected.snapshot,
    refresh,
    sessionRevision: session.revision,
    configId: identity?.configId,
  };
}
