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
  await waitFor(() => expect(result.current.isError).toBe(true));
});
it.each([
  {
    action: 'create',
    body: {
      name: 'Together',
      metric: 'steps',
      scoring_mode: 'sum',
      start_date: '2026-10-03',
      end_date: '2026-10-09',
      timezone: 'UTC',
      participant_ids: [],
    },
  },
  { action: 'rename', id: challenge.id, name: 'Tomorrow' },
  { action: 'invite', id: challenge.id, userId: actor },
] as const)('invalidates lists and results after $action', async (command) => {
  const context = setup();
  const invalidate = jest.spyOn(context.client, 'invalidateQueries');
  const { result } = renderHook(() => useChallengeMutation(), context);
  await act(() =>
    result.current.mutateAsync(
      command.action === 'create'
        ? { ...command, body: { ...command.body, participant_ids: [] } }
        : command
    )
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: challengeKeys.all(actor),
  });
});

it('rejects an obsolete mutation even when self access returns before its response', async () => {
  const context = setup();
  const invalidate = jest.spyOn(context.client, 'invalidateQueries');
  let resolve!: () => void;
  api.respond.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { result, rerender } = renderHook(
    () => useChallengeMutation(),
    context
  );
  let finished!: Promise<unknown>;
  act(() => {
    finished = result.current
      .mutateAsync({ action: 'accept', id: challenge.id })
      .catch((error: unknown) => error);
  });
  await waitFor(() => expect(api.respond).toHaveBeenCalledTimes(1));
  jest
    .mocked(useActiveUser)
    .mockReturnValue({ isActingOnBehalf: true } as ReturnType<
      typeof useActiveUser
    >);
  rerender();
  jest
    .mocked(useActiveUser)
    .mockReturnValue({ isActingOnBehalf: false } as ReturnType<
      typeof useActiveUser
    >);
  rerender();
  await act(async () => {
    resolve();
    await finished;
  });
  expect(await finished).toEqual(new Error('Challenge context changed'));
  expect(invalidate).not.toHaveBeenCalled();
});
it('paginates the authorized selected view without downloading other tabs', async () => {
  api.list.mockImplementation(async (offset = 0, view) => ({
    challenges: Array.from({ length: 20 }, (_, i) => ({
      ...challenge,
      id: `${view}-${offset + i}`,
      my_membership: 'pending' as const,
    })),
    limit: 20,
    offset,
    has_more: offset === 0,
  }));
  const { result } = renderHook(() => useChallenges('invitations'), setup());
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api.list).toHaveBeenCalledTimes(1);
  await act(() => result.current.fetchNextPage());
  await waitFor(() =>
    expect(result.current.data?.pages[1]?.challenges[0]?.id).toBe(
      'invitations-20'
    )
  );
  expect(result.current.hasNextPage).toBe(false);
  expect(api.list).toHaveBeenNthCalledWith(
    2,
    20,
    'invitations',
    expect.any(AbortSignal)
  );
  expect(api.results).not.toHaveBeenCalled();
});

it('hides cached result data as soon as access is denied or sharing is cancelled', async () => {
  const context = setup();
  const { result, rerender } = renderHook(
    ({ lifecycle }) => useChallengeResults({ ...challenge, lifecycle }),
    {
      ...context,
      initialProps: { lifecycle: 'active' as typeof challenge.lifecycle },
    }
  );
  await waitFor(() => expect(result.current.data).toEqual(results));
  rerender({ lifecycle: 'cancelled' });
  expect(result.current.data).toBeUndefined();
  rerender({ lifecycle: 'active' });
  api.results.mockRejectedValue(
    Object.assign(new Error('Denied'), { status: 403 })
  );
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toBeUndefined());
});
