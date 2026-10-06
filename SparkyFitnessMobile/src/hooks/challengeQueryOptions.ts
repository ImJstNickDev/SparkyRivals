import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { challengeReadRetry, type ChallengeListQuery } from '@workspace/shared';
import { challengesApi } from '../services/api/challengesApi';
import { challengeKeys } from './queryKeys';

// Shared by screens and the headless Watch projection: one cache and transport.
const freshness = { staleTime: 30_000, refetchOnReconnect: true } as const;
export const challengeListOptions = (
  actor: string,
  view?: ChallengeListQuery['view']
) =>
  infiniteQueryOptions({
    queryKey: view
      ? [...challengeKeys.list(actor), view]
      : challengeKeys.list(actor),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      challengesApi.list(pageParam, view, signal),
    getNextPageParam: (page) =>
      page.has_more && page.offset + page.limit <= 10000
        ? page.offset + page.limit
        : undefined,
    ...freshness,
    retry: challengeReadRetry,
  });
export const challengeResultsOptions = (actor: string, id: string) =>
  queryOptions({
    queryKey: challengeKeys.results(actor, id),
    queryFn: ({ signal }) => challengesApi.results(id, signal),
    ...freshness,
    retry: challengeReadRetry,
  });
