import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { challengesApi } from '../services/api/challengesApi';
import { challengeKeys } from './queryKeys';

// Shared by screens and the headless Watch projection: one cache and transport.
const freshness = { staleTime: 30_000, refetchOnReconnect: true } as const;
export const challengeListOptions = (actor: string) =>
  infiniteQueryOptions({
    queryKey: challengeKeys.list(actor),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => challengesApi.list(pageParam),
    getNextPageParam: (page) =>
      page.has_more && page.offset + page.limit <= 10000
        ? page.offset + page.limit
        : undefined,
    ...freshness,
  });
export const challengeResultsOptions = (actor: string, id: string) =>
  queryOptions({
    queryKey: challengeKeys.results(actor, id),
    queryFn: () => challengesApi.results(id),
    ...freshness,
  });
