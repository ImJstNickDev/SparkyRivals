import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { challengesApi } from '../../src/services/api/challengesApi';
import {
  useChallengeConnections,
  useChallengeDetail,
  useChallengeIdentity,
  useChallengeMutation,
  useChallengeResults,
  useChallenges,
  useChallengeRefresh,
  useChallengeScreenRefresh,
} from '../../src/hooks/useChallenges';
import { challengeKeys } from '../../src/hooks/queryKeys';
import { useProfile } from '../../src/hooks/useProfile';
import { createTestQueryClient, createQueryWrapper } from './queryTestUtils';
import { actor, challenge, detail, results } from '../helpers/challenges';
jest.mock('../../src/services/api/challengesApi');
jest.mock('../../src/hooks/useProfile');
jest.mock('../../src/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(callback, [callback]);
  },
}));
const api = jest.mocked(challengesApi);
function setup() {
  const client = createTestQueryClient();
  return { client, wrapper: createQueryWrapper(client) };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsFocused).mockReturnValue(true);
  jest.mocked(useProfile).mockReturnValue({
    profile: { id: actor },
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useProfile>);
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
it('loads identity-scoped data through shared contracts', async () => {
  const ctx = setup();
  const { result } = renderHook(
    () => ({
      list: useChallenges(),
      detail: useChallengeDetail(challenge.id),
      results: useChallengeResults(challenge),
      connections: useChallengeConnections(),
      identity: useChallengeIdentity(),
    }),
    ctx
  );
  await waitFor(() => expect(result.current.results.isSuccess).toBe(true));
  expect(result.current.identity.actor).toBe(actor);
  expect(result.current.detail.data).toEqual(detail);
  expect(ctx.client.getQueryData(challengeKeys.list(actor))).toBeDefined();
});
it.each(['pending', 'declined', 'left'] as const)(
  'never fetches scores for %s',
  (my_membership) => {
    renderHook(
      () => useChallengeResults({ ...challenge, my_membership }),
      setup()
    );
    expect(api.results).not.toHaveBeenCalled();
  }
);
it('does not fetch cancelled scores or unfocused screens', () => {
  jest.mocked(useIsFocused).mockReturnValue(false);
  renderHook(() => {
    useChallenges();
    useChallengeDetail(challenge.id);
    useChallengeResults({ ...challenge, lifecycle: 'cancelled' });
    useChallengeConnections();
  }, setup());
  expect(api.results).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
  expect(api.detail).not.toHaveBeenCalled();
  expect(api.connections).not.toHaveBeenCalled();
});
it('does not request data without a resolved account', () => {
  jest.mocked(useProfile).mockReturnValue({
    profile: undefined,
    isError: true,
    isLoading: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useProfile>);
  renderHook(() => useChallenges(), setup());
  expect(api.list).not.toHaveBeenCalled();
});
it.each(['accept', 'decline', 'leave', 'cancel'] as const)(
  'invalidates and revokes caches on %s',
  async (action) => {
    const ctx = setup();
    const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
    ctx.client.setQueryData(
      challengeKeys.results(actor, challenge.id),
      results
    );
    const { result } = renderHook(() => useChallengeMutation(), ctx);
    await act(() => result.current.mutateAsync({ action, id: challenge.id }));
    expect(api.respond).toHaveBeenCalledWith(challenge.id, action);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: challengeKeys.all(actor),
    });
    if (action === 'leave' || action === 'decline')
      expect(
        ctx.client.getQueryData(challengeKeys.results(actor, challenge.id))
      ).toBeUndefined();
  }
);
it('invalidates on creation, rename and invitation', async () => {
  const ctx = setup();
  const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
  api.create.mockResolvedValue(detail);
  api.rename.mockResolvedValue(detail);
  api.invite.mockResolvedValue(detail);
  const { result } = renderHook(() => useChallengeMutation(), ctx);
  await act(() =>
    result.current.mutateAsync({
      action: 'create',
      body: {
        name: 'Steps',
        start_date: '2026-10-04',
        end_date: '2026-10-10',
        timezone: 'UTC',
        metric: 'steps',
        scoring_mode: 'sum',
        participant_ids: [],
      },
    })
  );
  await act(() =>
    result.current.mutateAsync({
      action: 'rename',
      id: challenge.id,
      name: 'Steps',
    })
  );
  await act(() =>
    result.current.mutateAsync({
      action: 'invite',
      id: challenge.id,
      userId: actor,
    })
  );
  expect(invalidate).toHaveBeenCalledTimes(3);
});
it('refreshes the entire domain manually and on foreground while focused', async () => {
  const ctx = setup();
  const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
  const listener = jest.spyOn(AppState, 'addEventListener');
  const { result, unmount } = renderHook(
    () => ({
      manual: useChallengeRefresh(),
      focus: useChallengeScreenRefresh(),
    }),
    ctx
  );
  await act(() => result.current.manual());
  const callback = listener.mock.calls.find(([type]) => type === 'change')?.[1];
  act(() => {
    callback?.('active');
    callback?.('active');
  });
  expect(invalidate).toHaveBeenCalledTimes(2);
  unmount();
  listener.mockRestore();
});
it('surfaces offline failures and never retries membership writes', async () => {
  api.respond.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useChallengeMutation(), setup());
  await act(async () => {
    await expect(
      result.current.mutateAsync({ action: 'accept', id: challenge.id })
    ).rejects.toThrow('offline');
  });
  expect(api.respond).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(result.current.isError).toBe(true));
});
