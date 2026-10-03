import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CreateChallengeRequest,
  ChallengeResponse,
} from '@workspace/shared';
import { challengesApi } from '../services/api/challengesApi';
import { challengeKeys } from './queryKeys';
import { useProfile } from './useProfile';
import { useRefetchOnFocus } from './useRefetchOnFocus';
import {
  challengeListOptions,
  challengeResultsOptions,
} from './challengeQueryOptions';

export function useChallengeIdentity() {
  const profile = useProfile();
  return {
    actor: profile.profile?.id ?? '',
    enabled: !!profile.profile?.id && !profile.isError,
    isLoading: profile.isLoading,
    isError: profile.isError,
    refetch: profile.refetch,
  };
}
const freshness = { staleTime: 30_000, refetchOnReconnect: true } as const;
export function useChallenges() {
  const { actor, enabled } = useChallengeIdentity();
  const focused = useIsFocused();
  return useInfiniteQuery({
    ...challengeListOptions(actor),
    enabled: enabled && focused,
    ...freshness,
  });
}
export function useChallengeDetail(id: string) {
  const { actor, enabled } = useChallengeIdentity();
  const focused = useIsFocused();
  return useQuery({
    queryKey: challengeKeys.detail(actor, id),
    queryFn: () => challengesApi.detail(id),
    enabled: enabled && focused && !!id,
    ...freshness,
  });
}
export function useChallengeResults(challenge?: ChallengeResponse) {
  const { actor, enabled } = useChallengeIdentity();
  const focused = useIsFocused();
  return useQuery({
    ...challengeResultsOptions(actor, challenge?.id ?? ''),
    enabled:
      enabled &&
      focused &&
      challenge?.my_membership === 'accepted' &&
      challenge.lifecycle !== 'cancelled',
    ...freshness,
  });
}
export function useChallengeConnections() {
  const { actor, enabled } = useChallengeIdentity();
  const focused = useIsFocused();
  return useQuery({
    queryKey: challengeKeys.connections(actor),
    queryFn: challengesApi.connections,
    enabled: enabled && focused,
    ...freshness,
  });
}
export function useChallengeRefresh() {
  const client = useQueryClient();
  const { actor, enabled } = useChallengeIdentity();
  return useCallback(
    () =>
      enabled
        ? client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
        : Promise.resolve(),
    [client, actor, enabled]
  );
}
/** Navigation focus and foreground refresh; no background polling or extra sync. */
export function useChallengeScreenRefresh() {
  const refresh = useChallengeRefresh();
  const { enabled } = useChallengeIdentity();
  const last = useRef(0);
  const refreshNow = useCallback(() => {
    last.current = Date.now();
    void refresh();
  }, [refresh]);
  useRefetchOnFocus(refreshNow, enabled);
  useFocusEffect(
    useCallback(() => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (
          state === 'active' &&
          enabled &&
          Date.now() - last.current >= 30_000
        )
          refreshNow();
      });
      return () => subscription.remove();
    }, [enabled, refreshNow])
  );
  return refresh;
}
type ChallengeCommand =
  | { action: 'create'; body: CreateChallengeRequest }
  | { action: 'rename'; id: string; name: string }
  | { action: 'invite'; id: string; userId: string }
  | { action: 'accept' | 'decline' | 'leave' | 'cancel'; id: string };
export function useChallengeMutation() {
  const client = useQueryClient();
  const { actor, enabled } = useChallengeIdentity();
  return useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async (command: ChallengeCommand) => {
      if (!enabled) throw new Error('Challenge identity unavailable');
      switch (command.action) {
        case 'create':
          return challengesApi.create(command.body);
        case 'rename':
          return challengesApi.rename(command.id, command.name);
        case 'invite':
          return challengesApi.invite(command.id, command.userId);
        default:
          return challengesApi.respond(command.id, command.action);
      }
    },
    onSuccess: async (_data, command) => {
      if (command.action === 'leave' || command.action === 'decline') {
        client.removeQueries({
          queryKey: challengeKeys.detail(actor, command.id),
        });
        client.removeQueries({
          queryKey: challengeKeys.results(actor, command.id),
        });
      }
      await client.invalidateQueries({ queryKey: challengeKeys.all(actor) });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: challengeKeys.all(actor) });
    },
  });
}
