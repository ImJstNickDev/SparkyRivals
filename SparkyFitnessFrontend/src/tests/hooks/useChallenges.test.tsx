import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useChallengeConnections,
  useChallengeDetail,
  useChallengeIdentity,
  useChallengeMutation,
  useChallengeResults,
  useChallenges,
} from '@/hooks/Challenges/useChallenges';
import { challengeApi } from '@/api/Challenges/challenges';
import { challengeKeys } from '@/api/keys/challenges';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { actor, challenge, detail, results } from '../fixtures/challenges';
jest.mock('@/api/Challenges/challenges');
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' } }),
}));
jest.mock('@/contexts/ActiveUserContext', () => ({ useActiveUser: jest.fn() }));
const api = jest.mocked(challengeApi);
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useActiveUser)
    .mockReturnValue({ isActingOnBehalf: false } as ReturnType<
      typeof useActiveUser
    >);
  api.list.mockResolvedValue({
    challenges: [challenge],
    limit: 20,
    offset: 0,
    has_more: false,
  });
  api.detail.mockResolvedValue(detail);
  api.results.mockResolvedValue(results);
  api.connections.mockResolvedValue([]);
});
it('loads scoped lists, details, results and relationships', async () => {
  const context = setup();
  const { result } = renderHook(
    () => ({
      list: useChallenges(),
      detail: useChallengeDetail(challenge.id),
      results: useChallengeResults(challenge),
      connections: useChallengeConnections(),
      identity: useChallengeIdentity(),
    }),
    context
  );
  await waitFor(() => expect(result.current.results.isSuccess).toBe(true));
  expect(result.current.identity.actor).toBe(actor);
  expect(result.current.detail.data).toEqual(detail);
  expect(context.client.getQueryData(challengeKeys.list(actor))).toBeDefined();
});
it.each(['pending', 'declined', 'left'] as const)(
  'never requests scores for %s',
  (my_membership) => {
    renderHook(
      () => useChallengeResults({ ...challenge, my_membership }),
      setup()
    );
    expect(api.results).not.toHaveBeenCalled();
  }
);
it('does not request cancelled scores or delegated data', () => {
  jest
    .mocked(useActiveUser)
    .mockReturnValue({ isActingOnBehalf: true } as ReturnType<
      typeof useActiveUser
    >);
  renderHook(() => {
    useChallenges();
    useChallengeDetail(challenge.id);
    useChallengeConnections();
    useChallengeResults({ ...challenge, lifecycle: 'cancelled' });
  }, setup());
  expect(api.list).not.toHaveBeenCalled();
  expect(api.detail).not.toHaveBeenCalled();
  expect(api.results).not.toHaveBeenCalled();
  expect(api.connections).not.toHaveBeenCalled();
});
it.each(['accept', 'decline', 'leave', 'cancel'] as const)(
  'invalidates all related caches after %s',
  async (action) => {
    const context = setup();
    context.client.setQueryData(
      challengeKeys.detail(actor, challenge.id),
      detail
    );
    context.client.setQueryData(
      challengeKeys.results(actor, challenge.id),
      results
    );
    const invalidate = jest.spyOn(context.client, 'invalidateQueries');
    const { result } = renderHook(() => useChallengeMutation(), context);
    await act(() => result.current.mutateAsync({ action, id: challenge.id }));
    expect(api.respond).toHaveBeenCalledWith(challenge.id, action);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: challengeKeys.all(actor),
    });
    if (action === 'decline' || action === 'leave')
      expect(
        context.client.getQueryData(challengeKeys.results(actor, challenge.id))
      ).toBeUndefined();
  }
);
it('surfaces failed actions without a success claim', async () => {
  api.respond.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useChallengeMutation(), setup());
  await act(async () => {
    await expect(
      result.current.mutateAsync({ action: 'accept', id: challenge.id })
    ).rejects.toThrow('offline');
  });
  expect(result.current.isError).toBe(true);
});
