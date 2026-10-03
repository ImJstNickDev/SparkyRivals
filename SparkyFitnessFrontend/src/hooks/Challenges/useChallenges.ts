import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type CreateChallengeRequest,
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
export function useChallenges() {
  const { actor, enabled } = useChallengeIdentity();
  return useInfiniteQuery({
    queryKey: challengeKeys.list(actor),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => challengeApi.list(pageParam),
    getNextPageParam: (page) =>
      page.has_more && page.offset + page.limit <= 10000
        ? page.offset + page.limit
        : undefined,
    enabled,
    ...freshness,
  });
}
export function useChallengeDetail(id: string) {
  const { actor, enabled } = useChallengeIdentity();
  return useQuery({
    queryKey: challengeKeys.detail(actor, id),
    queryFn: () => challengeApi.detail(id),
    enabled: enabled && !!id,
    ...freshness,
  });
}
export function useChallengeResults(challenge?: ChallengeResponse) {
  const { actor, enabled } = useChallengeIdentity();
  return useQuery({
    queryKey: challengeKeys.results(actor, challenge?.id ?? ''),
    queryFn: () => challengeApi.results(challenge!.id),
    enabled:
      enabled &&
      challenge?.my_membership === 'accepted' &&
      challenge.lifecycle !== 'cancelled',
    ...freshness,
  });
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
  | { action: 'rename'; id: string; name: string }
  | { action: 'invite'; id: string; userId: string }
  | { action: 'accept' | 'decline' | 'leave' | 'cancel'; id: string };
export function useChallengeMutation() {
  const client = useQueryClient();
  const { actor, enabled } = useChallengeIdentity();
  return useMutation({
    retry: false,
    // Fail immediately while offline; never queue membership changes for later.
    networkMode: 'always',
    mutationFn: async (command: ChallengeCommand) => {
      if (!enabled) throw new Error('Challenge self context required');
      switch (command.action) {
        case 'create':
          return challengeApi.create(command.body);
        case 'rename':
          return challengeApi.rename(command.id, command.name);
        case 'invite':
          return challengeApi.invite(command.id, command.userId);
        default:
          return challengeApi.respond(command.id, command.action);
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
