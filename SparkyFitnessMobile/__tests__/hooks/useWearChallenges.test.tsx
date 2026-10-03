import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useWearChallenges } from '../../src/hooks/useWearChallenges';
import WearConnectivity from '../../modules/wear-connectivity';
import { challengesApi } from '../../src/services/api/challengesApi';
import { fetchProfile } from '../../src/services/api/profileApi';
import { getActiveServerConfigId } from '../../src/services/storage';
import { invalidateCompanionChallengeSession } from '../../src/services/companionChallengeSession';
import { refreshHealthSyncCache } from '../../src/hooks/refreshHealthSyncCache';
import { challengeKeys } from '../../src/hooks/queryKeys';
import { createTestQueryClient, createQueryWrapper } from './queryTestUtils';
import { actor, challenge, results } from '../helpers/challenges';
jest.mock('../../modules/wear-connectivity', () => ({
  __esModule: true,
  default: { publishSnapshot: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../src/services/api/challengesApi');
jest.mock('../../src/services/api/profileApi');
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
jest.mock('../../src/services/LogService', () => ({ addLog: jest.fn() }));
const native = jest.mocked(WearConnectivity!);
const api = jest.mocked(challengesApi);
const latest = () => JSON.parse(native.publishSnapshot.mock.calls.at(-1)![0]);
function setup() {
  const client = createTestQueryClient();
  return { client, wrapper: createQueryWrapper(client) };
}
beforeEach(() => {
  jest.clearAllMocks();
  invalidateCompanionChallengeSession(false);
  jest.mocked(getActiveServerConfigId).mockResolvedValue('server');
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
it('clears on mount then publishes authoritative cached results without a parallel API client', async () => {
  const ctx = setup();
  renderHook(() => useWearChallenges(true), ctx);
  await waitFor(() => expect(latest().items[0]?.rows).toHaveLength(2));
  expect(JSON.parse(native.publishSnapshot.mock.calls[0][0]).state).toBe(
    'unavailable'
  );
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(api.results).toHaveBeenCalledTimes(1);
});
it('republishes after health sync and Challenge mutation invalidation', async () => {
  const ctx = setup();
  renderHook(() => useWearChallenges(true), ctx);
  await waitFor(() => expect(latest().items[0]?.rows).toHaveLength(2));
  api.results.mockResolvedValue({
    ...results,
    entries: results.entries.map((r) => ({ ...r, total_score: 3 })),
  });
  act(() => refreshHealthSyncCache(ctx.client));
  await waitFor(() => expect(latest().items[0]?.rows[0]?.total).toBe(3));
  api.list.mockResolvedValue({
    challenges: [],
    offset: 0,
    limit: 20,
    has_more: false,
  });
  await act(() =>
    ctx.client.invalidateQueries({ queryKey: challengeKeys.all(actor) })
  );
  await waitFor(() => expect(latest().items).toEqual([]));
});
it('logout sends a clear immediately, even offline', async () => {
  const ctx = setup();
  const { rerender } = renderHook(
    ({ connected }) => useWearChallenges(connected),
    { ...ctx, initialProps: { connected: true } }
  );
  await waitFor(() => expect(latest().state).toBe('ready'));
  rerender({ connected: false });
  act(() => invalidateCompanionChallengeSession(true));
  await waitFor(() =>
    expect(latest()).toMatchObject({
      state: 'unavailable',
      accountKey: '',
      items: [],
    })
  );
});
it('foreground refreshes the shared cache without a periodic network timer', async () => {
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() });
  const ctx = setup();
  renderHook(() => useWearChallenges(true), ctx);
  await waitFor(() => expect(latest().items[0]?.rows).toHaveLength(2));
  const invalidate = jest.spyOn(ctx.client, 'invalidateQueries');
  const handler = listener.mock.calls.at(-1)![1];
  act(() => {
    handler('active');
    handler('active');
  });
  expect(invalidate).toHaveBeenCalledTimes(1);
  // The suite owns this mock until React finishes cleanup.
});
