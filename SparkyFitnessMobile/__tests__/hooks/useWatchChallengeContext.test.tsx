import { act, renderHook, waitFor } from '@testing-library/react-native';
import WatchConnectivity, {
  type WatchContextPayload,
} from '../../modules/watch-connectivity';
import { useWatchCheckInBridge } from '../../src/hooks/useWatchCheckInBridge';
import { useWatchChallenges } from '../../src/hooks/useWatchChallenges';
import {
  getWatchChallengeSession,
  invalidateWatchChallengeSession,
} from '../../src/services/watchChallengeSession';
import {
  buildWatchChallenges,
  emptyWatchChallenges,
} from '../../src/utils/watchChallenges';
import { getActiveServerConfigId } from '../../src/services/storage';
import { fetchMeasurementsRange } from '../../src/services/api/measurementsApi';
import { queryClient } from '../../src/hooks/queryClient';
import { createQueryWrapper } from './queryTestUtils';
import { actor, challenge, results } from '../helpers/challenges';
const mockListeners = new Map<string, (payload?: unknown) => void>();
jest.mock('../../modules/watch-connectivity', () => ({
  __esModule: true,
  default: {
    isSupported: () => true,
    isPaired: () => true,
    updateContext: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn((name, callback) => {
      mockListeners.set(name, callback);
      return { remove: jest.fn() };
    }),
  },
}));
jest.mock('../../src/hooks/useWatchChallenges');
jest.mock('../../src/hooks/usePreferences', () => ({
  usePreferences: () => ({ preferences: { default_weight_unit: 'lbs' } }),
}));
const mockEmpty: never[] = [];
jest.mock('../../src/hooks/useCustomNutrients', () => ({
  useCustomNutrients: () => ({ customNutrients: mockEmpty }),
}));
jest.mock('../../src/hooks/useWorkoutPresets', () => ({
  useWorkoutPresets: () => ({ presets: mockEmpty }),
}));
const mockSummary = {
  calorieBalance: {
    eaten: 1500,
    burned: 2100,
    remaining: 600,
    goal: 2100,
    progress: 71,
  },
  protein: { consumed: 90, goal: 120 },
  carbs: { consumed: 180, goal: 250 },
  fat: { consumed: 40, goal: 60 },
  waterConsumed: 1250,
  waterGoal: 2000,
};
jest.mock('../../src/hooks/useDailySummary', () => ({
  useDailySummary: () => ({ summary: mockSummary }),
}));
jest.mock('../../src/utils/watchNutrients', () => ({
  buildWatchGoalNutrients: () => [],
  shownInOrder: () => [],
}));
jest.mock('../../src/services/api/measurementsApi', () => ({
  fetchMeasurementsRange: jest.fn(),
  fetchWaterContainers: jest.fn(async () => []),
  fetchWaterIntakeLog: jest.fn(async () => []),
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
const mockSnapshot = buildWatchChallenges({
  accountKey: `server:${actor}`,
  actor,
  challenges: [challenge],
  listUpdatedAt: 2000,
  hasMore: false,
  results: new Map([[challenge.id, { data: results, dataUpdatedAt: 1000 }]]),
});
const refresh = jest.fn();
const native = jest.mocked(WatchConnectivity!);
const latest = (): WatchContextPayload =>
  native.updateContext.mock.calls.at(-1)![0];
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  mockListeners.clear();
  invalidateWatchChallengeSession(false);
  jest.mocked(getActiveServerConfigId).mockResolvedValue('server');
  jest.mocked(fetchMeasurementsRange).mockResolvedValue([]);
  jest.mocked(useWatchChallenges).mockImplementation(() => ({
    snapshot: mockSnapshot,
    refresh,
    sessionRevision: getWatchChallengeSession().revision,
    configId: 'server',
  }));
});
afterEach(() => queryClient.clear());
it('composes Challenge with every existing context family using the sole writer', async () => {
  renderHook(() => useWatchCheckInBridge(true), {
    wrapper: createQueryWrapper(queryClient),
  });
  await waitFor(() => expect(native.updateContext).toHaveBeenCalled());
  expect(latest()).toMatchObject({
    challengeSnapshot: mockSnapshot,
    caloriesConsumed: 1500,
    waterConsumedMl: 1250,
    waterGoalMl: 2000,
    weightUnit: 'lbs',
    history: [],
    containers: [],
    ackedClientIds: [],
    failedClientIds: [],
    startableWorkouts: [],
    workoutServerId: 'server',
  });
  for (const key of [
    'pageOrder',
    'hiddenPages',
    'setInputStyle',
    'goalNutrients',
    'hapticsEnabled',
    'restAlertsEnabled',
  ])
    expect(latest()).toHaveProperty(key);
});
it('pushes an auth clear immediately even while measurements and server are unavailable', async () => {
  jest
    .mocked(fetchMeasurementsRange)
    .mockImplementation(() => new Promise(() => {}));
  const { rerender } = renderHook(
    ({ connected }) => useWatchCheckInBridge(connected),
    {
      wrapper: createQueryWrapper(queryClient),
      initialProps: { connected: true },
    }
  );
  await waitFor(() => expect(latest().challengeSnapshot?.state).toBe('ready'));
  rerender({ connected: false });
  act(() => invalidateWatchChallengeSession(true));
  expect(latest().challengeSnapshot).toEqual(emptyWatchChallenges());
});
it('prevents an in-flight older push from overwriting a clear', async () => {
  let release: (id: string) => void = () => {};
  jest.mocked(getActiveServerConfigId).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  renderHook(() => useWatchCheckInBridge(true), {
    wrapper: createQueryWrapper(queryClient),
  });
  act(() => invalidateWatchChallengeSession(true));
  expect(latest().challengeSnapshot?.state).toBe('unavailable');
  const count = native.updateContext.mock.calls.length;
  await act(async () => {
    release('server');
  });
  expect(
    native.updateContext.mock.calls
      .slice(count)
      .every(([c]) => c.challengeSnapshot?.state !== 'ready')
  ).toBe(true);
});
it('recomposes when reconciled Challenge data changes, preserving the other pages', async () => {
  const { rerender } = renderHook(() => useWatchCheckInBridge(true), {
    wrapper: createQueryWrapper(queryClient),
  });
  await waitFor(() => expect(native.updateContext).toHaveBeenCalled());
  const corrected = { ...mockSnapshot, generatedAt: 3000, items: [] };
  jest.mocked(useWatchChallenges).mockReturnValue({
    snapshot: corrected,
    refresh,
    sessionRevision: getWatchChallengeSession().revision,
    configId: 'server',
  });
  rerender({});
  await waitFor(() => expect(latest().challengeSnapshot).toEqual(corrected));
  expect(latest().waterConsumedMl).toBe(1250);
});
it('context requests reuse the same composer and refresh shared queries', async () => {
  renderHook(() => useWatchCheckInBridge(true), {
    wrapper: createQueryWrapper(queryClient),
  });
  await waitFor(() => expect(native.updateContext).toHaveBeenCalled());
  await act(async () => {
    mockListeners.get('onContextRequest')?.();
  });
  expect(refresh).toHaveBeenCalled();
  expect(latest().challengeSnapshot).toEqual(mockSnapshot);
});
