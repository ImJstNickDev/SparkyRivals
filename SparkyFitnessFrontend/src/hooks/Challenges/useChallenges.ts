import { challengeReadBlocked, challengeReadRetry } from '@workspace/shared';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type CreateChallengeRequest,
  type ChallengeListQuery,
  type ChallengeResponse,
} from '@workspace/shared';
import { useAuth } from '@/hooks/useAuth';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { challengeApi } from '@/api/Challenges/challenges';
import { challengeKeys } from '@/api/keys/challenges';

export function useChallengeIdentity() {
  const { user } = useAuth();
  const { isActingOnBehalf } = useActiveUser();
  return { actor: user?.id ?? '', enabled: !!user && !isActingOnBehalf };
}
const freshness = {
  staleTime: 30_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;
export function useChallengeRefresh() {
  const client = useQueryClient();
  const { actor, enabled } = useChallengeIdentity();
  return () =>
    enabled
      ? client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
      : Promise.resolve();
}
export function useChallenges(view?: ChallengeListQuery['view']) {
  const { actor, enabled } = useChallengeIdentity();
  const query = useInfiniteQuery({
    queryKey: view
      ? [...challengeKeys.list(actor), view]
      : challengeKeys.list(actor),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      challengeApi.list(pageParam, view, signal),
    getNextPageParam: (page) =>
      page.has_more && page.offset + page.limit <= 10000
        ? page.offset + page.limit
        : undefined,
    enabled,
    ...freshness,
    retry: challengeReadRetry,
  });
  return {
    ...query,
    data:
      !enabled || challengeReadBlocked(query.error) ? undefined : query.data,
  };
}
export function useChallengeDetail(id: string) {
  const { actor, enabled } = useChallengeIdentity();
  const query = useQuery({
    queryKey: challengeKeys.detail(actor, id),
    queryFn: ({ signal }) => challengeApi.detail(id, signal),
    enabled: enabled && !!id,
    ...freshness,
    retry: challengeReadRetry,
  });
  return {
    ...query,
    data:
      !enabled || challengeReadBlocked(query.error) ? undefined : query.data,
  };
}
export function useChallengeResults(challenge?: ChallengeResponse) {
  const { actor, enabled } = useChallengeIdentity();
  const mayReadResults =
    enabled &&
    challenge?.my_membership === 'accepted' &&
    ['active', 'completed'].includes(challenge.lifecycle);
  const query = useQuery({
    queryKey: challengeKeys.results(actor, challenge?.id ?? ''),
    queryFn: ({ signal }) => challengeApi.results(challenge!.id, signal),
    enabled: mayReadResults,
    ...freshness,
    retry: challengeReadRetry,
  });
  return {
    ...query,
    data:
      !mayReadResults || challengeReadBlocked(query.error)
        ? undefined
        : query.data,
  };
}
export function useChallengeConnections() {
  const { actor, enabled } = useChallengeIdentity();
  return useQuery({
    queryKey: challengeKeys.connections(actor),
    queryFn: challengeApi.connections,
    enabled,
    ...freshness,
  });
}
type ChallengeCommand =
  | { action: 'create'; body: CreateChallengeRequest }
  | { action: 'target'; id: string; target: number; revision: number }
  | { action: 'ready'; id: string; ready: boolean; revision: number }
  | { action: 'withdraw' | 'removeParticipant'; id: string; userId: string }
  | { action: 'rename'; id: string; name: string }
  | { action: 'invite'; id: string; userId: string }
  | { action: 'accept' | 'decline' | 'leave' | 'cancel'; id: string };
export function useChallengeMutation() {
  const client = useQueryClient();
  const { actor, enabled } = useChallengeIdentity();
  const [session, setSession] = useState({ actor, enabled });
  if (session.actor !== actor || session.enabled !== enabled)
    setSession({ actor, enabled });
  const latest = useRef(session);
  useLayoutEffect(() => {
    latest.current = session;
  }, [session]);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () =>
    mounted.current &&
    enabled &&
    latest.current.enabled &&
    latest.current === session;
  return useMutation({
    retry: false,
    // Fail immediately while offline; never queue membership changes for later.
    networkMode: 'always',
    onMutate: () => ({ session }),
    mutationFn: async (command: ChallengeCommand) => {
      if (!current()) throw new Error('Challenge self context required');
      const execute = async () => {
        switch (command.action) {
          case 'create':
            return challengeApi.create(command.body);
          case 'rename':
            return challengeApi.rename(command.id, command.name);
          case 'target':
            return challengeApi.target(
              command.id,
              command.target,
              command.revision
            );
          case 'ready':
            return challengeApi.ready(
              command.id,
              command.ready,
              command.revision
            );
          case 'removeParticipant':
            return challengeApi.removeParticipant(command.id, command.userId);
          case 'withdraw':
            return challengeApi.withdraw(command.id, command.userId);
          case 'invite':
            return challengeApi.invite(command.id, command.userId);
          default:
            return challengeApi.respond(command.id, command.action);
        }
      };
      const result = await execute();
      if (!current()) throw new Error('Challenge context changed');
      return result;
    },
    onSuccess: async (_data, command, context) => {
      if (!current() || context.session !== session) return;
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
    onError: (_error, _command, context) => {
      if (!current() || context?.session !== session) return;
      void client.invalidateQueries({ queryKey: challengeKeys.all(actor) });
    },
  });
}
