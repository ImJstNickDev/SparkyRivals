import { useWatchConnectivity } from '../../src/hooks/useWatchConnectivity';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWatchChallenges } from '../../src/hooks/useWatchChallenges';
import {
  useChallenges,
  useChallengeResults,
} from '../../src/hooks/useChallenges';
import { challengesApi } from '../../src/services/api/challengesApi';
import { fetchProfile } from '../../src/services/api/profileApi';
import { getActiveServerConfigId } from '../../src/services/storage';
import { invalidateWatchChallengeSession } from '../../src/services/watchChallengeSession';
import { challengeKeys } from '../../src/hooks/queryKeys';
import { refreshHealthSyncCache } from '../../src/hooks/refreshHealthSyncCache';
import { createTestQueryClient, createQueryWrapper } from './queryTestUtils';
import { actor, peer, challenge, results } from '../helpers/challenges';
import { ApiError } from '../../src/services/api/errors';
jest.mock('../../modules/watch-connectivity', () => ({
  __esModule: true,
  default: { isSupported: () => true, isPaired: () => true },
}));
jest.mock('../../src/services/api/challengesApi');
jest.mock('../../src/hooks/useWatchConnectivity');
jest.mock('../../src/services/api/profileApi');
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
jest.mock('../../src/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { id: '11111111-1111-4111-8111-111111111111' },
  }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const api = jest.mocked(challengesApi);
const config = jest.mocked(getActiveServerConfigId);
function setup() {
  const client = createTestQueryClient();
  return { client, wrapper: createQueryWrapper(client) };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useWatchConnectivity)
    .mockReturnValue({ isSupported: true, isPaired: true, isReachable: true });
  invalidateWatchChallengeSession(false);
  config.mockResolvedValue('server-a');
  jest
    .mocked(fetchProfile)
    .mockResolvedValue({ id: actor } as Awaited<
      ReturnType<typeof fetchProfile>
    >);
  api.list.mockResolvedValue({
    challenges: [challenge],
    offset: 0,
    limit: 20,
    has_more: false,
  });
  api.results.mockResolvedValue(results);
});
it('reuses fresh screen caches without duplicate network calls', async () => {
  const ctx = setup();
  const { result } = renderHook(() => {
    useChallenges();
    useChallengeResults(challenge);
    return useWatchChallenges(true);
  }, ctx);
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(api.results).toHaveBeenCalledTimes(1);
  expect(result.current.snapshot.accountKey).toBe(`server-a:${actor}`);
});
it('never requests leaderboard for pending/cancelled/declined/left entries', async () => {
  api.list.mockResolvedValue({
    challenges: [
      { ...challenge, my_membership: 'pending' },
      { ...challenge, id: 'cancelled', lifecycle: 'cancelled' },
      { ...challenge, id: 'declined', my_membership: 'declined' },
      { ...challenge, id: 'left', my_membership: 'left' },
    ],
    offset: 0,
    limit: 20,
    has_more: false,
  });
  const { result } = renderHook(() => useWatchChallenges(true), setup());
  await waitFor(() => expect(result.current.snapshot.state).toBe('ready'));
  expect(result.current.snapshot.items).toHaveLength(1);
  expect(result.current.snapshot.items[0].rows).toEqual([]);
  expect(api.results).not.toHaveBeenCalled();
});
it('retains last valid data and timestamp during a transient disconnection', async () => {
  const ctx = setup();
  const { result, rerender } = renderHook(
    ({ connected }) => useWatchChallenges(connected),
    { ...ctx, initialProps: { connected: true } }
  );
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  const snapshot = result.current.snapshot;
  api.list.mockRejectedValue(new Error('Offline'));
  api.results.mockRejectedValue(new Error('Offline'));
  await act(() =>
    ctx.client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
  );
  expect(result.current.snapshot).toEqual(snapshot);
  rerender({ connected: false });
  expect(result.current.snapshot).toEqual(snapshot);
});
it.each(['server-b', 'server-a'])(
  'clears before new %s account data resolves, even for a reused user id',
  async (newServer) => {
    const ctx = setup();
    const { result } = renderHook(() => useWatchChallenges(true), ctx);
    await waitFor(() =>
      expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
    );
    act(() => {
      invalidateWatchChallengeSession(true);
      ctx.client.clear();
    });
    expect(result.current.snapshot).toMatchObject({
      state: 'unavailable',
      items: [],
      accountKey: '',
    });
    config.mockResolvedValue(newServer);
    // Hold the new account's request: it must never inherit the old rows.
    api.list.mockImplementation(() => new Promise(() => {}));
    act(() => invalidateWatchChallengeSession(false));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(result.current.snapshot.items).toEqual([]);
  }
);
it('logout clears even when the phone is offline', async () => {
  const ctx = setup();
  const { result, rerender } = renderHook(
    ({ connected }) => useWatchChallenges(connected),
    { ...ctx, initialProps: { connected: true } }
  );
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  rerender({ connected: false });
  act(() => invalidateWatchChallengeSession(true));
  expect(result.current.snapshot).toMatchObject({
    state: 'unavailable',
    items: [],
  });
});
it('rejects an identity response whose config changed while profile loading', async () => {
  config.mockResolvedValueOnce('server-a').mockResolvedValue('server-b');
  const { result } = renderHook(() => useWatchChallenges(true), setup());
  await act(async () => {});
  expect(result.current.snapshot.state).toBe('unavailable');
  expect(api.list).not.toHaveBeenCalled();
});
it('health/mutation cache invalidation updates reconciled snapshot values', async () => {
  const ctx = setup();
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  api.results.mockResolvedValue({
    ...results,
    entries: results.entries.map((r) => ({ ...r, total_score: 7 })),
  });
  act(() => refreshHealthSyncCache(ctx.client));
  await waitFor(() =>
    expect(result.current.snapshot.items[0].rows[0].total).toBe(7)
  );
});
it('access denied removes cached rows; list auth denial clears everything', async () => {
  const ctx = setup();
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  api.results.mockRejectedValue(new ApiError('Access revoked', 403));
  await act(() =>
    ctx.client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
  );
  await waitFor(() => expect(result.current.snapshot.items).toEqual([]));
  api.list.mockRejectedValue(new ApiError('Expired', 401));
  await act(() =>
    ctx.client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
  );
  await waitFor(() =>
    expect(result.current.snapshot.state).toBe('unavailable')
  );
});
it('bounds result queries and advertises further history', async () => {
  api.list.mockResolvedValue({
    challenges: Array.from({ length: 20 }, (_, i) => ({
      ...challenge,
      id: String(i),
    })),
    offset: 0,
    limit: 20,
    has_more: true,
  });
  const { result } = renderHook(() => useWatchChallenges(true), setup());
  await waitFor(() => expect(result.current.snapshot.items).toHaveLength(8));
  expect(api.results).toHaveBeenCalledTimes(8);
  expect(result.current.snapshot.hasMore).toBe(true);
});
it('throttles context/foreground refresh without polling', async () => {
  const ctx = setup();
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
  act(() => {
    result.current.refresh();
    result.current.refresh();
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
});
it('updates the account guard when a different authenticated user logs in', async () => {
  const ctx = setup();
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() =>
    expect(result.current.snapshot.accountKey).toBe(`server-a:${actor}`)
  );
  act(() => {
    invalidateWatchChallengeSession(true);
    ctx.client.clear();
  });
  jest
    .mocked(fetchProfile)
    .mockResolvedValue({ id: peer } as Awaited<
      ReturnType<typeof fetchProfile>
    >);
  act(() => invalidateWatchChallengeSession(false));
  await waitFor(() =>
    expect(result.current.snapshot.accountKey).toBe(`server-a:${peer}`)
  );
  expect(result.current.snapshot.items[0].rows.find((r) => r.isSelf)?.id).toBe(
    peer
  );
});

it('an API-key authentication failure on one result clears the entire snapshot', async () => {
  const ctx = setup();
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
  api.results.mockRejectedValue(new ApiError('Invalid API key', 401));
  await act(() =>
    ctx.client.invalidateQueries({
      queryKey: challengeKeys.results(actor, challenge.id),
    })
  );
  await waitFor(() =>
    expect(result.current.snapshot.state).toBe('unavailable')
  );
});
it('recovers a failed cold-start profile check on a later context refresh', async () => {
  const ctx = setup();
  jest.mocked(fetchProfile).mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useWatchChallenges(true), ctx);
  await waitFor(() => expect(fetchProfile).toHaveBeenCalledTimes(1));
  await act(async () => {});
  act(() => result.current.refresh());
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
});
it('starts observing when a watch pairs and makes no Watch requests on unsupported platforms', async () => {
  jest.mocked(useWatchConnectivity).mockReturnValue({
    isSupported: false,
    isPaired: false,
    isReachable: false,
  });
  const { result, rerender } = renderHook(
    () => useWatchChallenges(true),
    setup()
  );
  await act(async () => {});
  expect(api.list).not.toHaveBeenCalled();
  jest
    .mocked(useWatchConnectivity)
    .mockReturnValue({ isSupported: true, isPaired: true, isReachable: true });
  rerender({});
  await waitFor(() =>
    expect(result.current.snapshot.items[0]?.rows).toHaveLength(2)
  );
});

it('deduplicates simultaneous foreground refreshes from companion and widget observers', async () => {
  const ctx = setup();
  const { result } = renderHook(
    () => ({
      first: useWatchChallenges(true),
      second: useWatchChallenges(true),
    }),
    ctx
  );
  await waitFor(() =>
    expect(result.current.first.snapshot.items[0]?.rows).toHaveLength(2)
  );
  expect(api.results).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.first.refresh();
    result.current.second.refresh();
  });
  await waitFor(() => expect(api.results).toHaveBeenCalledTimes(2));
  expect(api.list).toHaveBeenCalledTimes(2);
});
