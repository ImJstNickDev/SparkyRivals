import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { preferencesQueryKey } from '../../src/hooks/queryKeys';
import {
  remotePushRegistration,
  remoteInvitationsEligible,
} from '../../src/services/remotePushRegistration';
import { useAppPreferencesStore } from '../../src/stores/appPreferencesStore';
import {
  act,
  renderHook as nativeRenderHook,
  waitFor,
} from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useChallengeSurfaces } from '../../src/hooks/useChallengeSurfaces';
import { useCompanionChallenges } from '../../src/hooks/useCompanionChallenges';
import { publishChallengeWidget } from '../../src/services/challengeWidgetPublisher';
import { getActiveServerConfigId } from '../../src/services/storage';
import {
  getCompanionChallengeSession,
  invalidateCompanionChallengeSession,
} from '../../src/services/companionChallengeSession';
import type { CompanionChallengeSnapshot } from '../../src/types/companionChallenges';
import fixture from '../fixtures/watch-challenges.json';
jest.mock('../../src/hooks/useCompanionChallenges', () => ({
  useCompanionChallenges: jest.fn(),
}));
jest.mock('../../src/services/challengeWidgetPublisher', () => ({
  publishChallengeWidget: jest.fn(),
}));
jest.mock('../../src/services/challengeNotifications', () => ({
  ChallengeNotificationReconciler: jest.fn(() => ({ reconcile: jest.fn() })),
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
jest.mock('../../src/services/remotePushRegistration', () => ({
  remotePushRegistration: {
    reconcile: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  },
  remoteInvitationsEligible: jest.fn(() => false),
}));
let client: QueryClient;
const renderHook = (callback: () => void) =>
  nativeRenderHook(callback, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
const publish = jest.mocked(publishChallengeWidget);
const snapshot = fixture as CompanionChallengeSnapshot;
const refresh = jest.fn();
function state(value = snapshot) {
  return {
    snapshot: value,
    observation: { challenges: [], freshList: false, freshResultIds: [] },
    sessionRevision: getCompanionChallengeSession().revision,
    configId: 'config',
    refresh,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(preferencesQueryKey, {});
  invalidateCompanionChallengeSession(false);
  jest.mocked(getActiveServerConfigId).mockResolvedValue('config');
  jest.mocked(useCompanionChallenges).mockReturnValue(state());
  publish.mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());
it('publishes existing cache and a corrected result without a separate fetch', async () => {
  const hook = renderHook(() => useChallengeSurfaces(true));
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].state).toBe('ready')
  );
  expect(publish.mock.calls.at(-1)?.[0].generatedAt).toBe(1000);
  const changed = { ...snapshot, generatedAt: 2000 };
  jest.mocked(useCompanionChallenges).mockReturnValue(state(changed));
  hook.rerender({});
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].generatedAt).toBe(2000)
  );
  expect(refresh).not.toHaveBeenCalled();
});
it('logout clears even if React still holds old cached rows', async () => {
  renderHook(() => useChallengeSurfaces(true));
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].state).toBe('ready')
  );
  act(() => invalidateCompanionChallengeSession(true));
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].accountKey).toBe('')
  );
  expect(publish.mock.calls.at(-1)?.[0].score).toBe('');
});
it('network disconnection does not replace verified time with now', async () => {
  renderHook(() => useChallengeSurfaces(false));
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].state).toBe('ready')
  );
  expect(publish.mock.calls.at(-1)?.[0].generatedAt).toBe(1000);
});
it('unsupported platforms perform no native writes', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  renderHook(() => useChallengeSurfaces(true));
  await act(async () => {
    await Promise.resolve();
  });
  expect(publish).not.toHaveBeenCalled();
});

it('preserves a cold push binding during initial query loading, then reconciles the verified account', async () => {
  jest
    .spyOn(useAppPreferencesStore.persist, 'hasHydrated')
    .mockReturnValue(true);
  jest.mocked(remoteInvitationsEligible).mockReturnValue(true);
  jest
    .mocked(useCompanionChallenges)
    .mockReturnValue(
      state({ ...snapshot, state: 'unavailable', accountKey: '' })
    );
  const hook = renderHook(() => useChallengeSurfaces(true));
  expect(remotePushRegistration.clear).not.toHaveBeenCalled();
  expect(remotePushRegistration.reconcile).not.toHaveBeenCalled();
  jest.mocked(useCompanionChallenges).mockReturnValue(state());
  hook.rerender({});
  expect(remotePushRegistration.reconcile).toHaveBeenCalledWith(
    expect.objectContaining({ account: snapshot.accountKey, enabled: true }),
    undefined
  );
});
it('disabled consent revokes even when the Challenge query is still loading', () => {
  jest
    .spyOn(useAppPreferencesStore.persist, 'hasHydrated')
    .mockReturnValue(true);
  jest.mocked(remoteInvitationsEligible).mockReturnValue(false);
  jest
    .mocked(useCompanionChallenges)
    .mockReturnValue(
      state({ ...snapshot, state: 'unavailable', accountKey: '' })
    );
  renderHook(() => useChallengeSurfaces(true));
  expect(remotePushRegistration.clear).toHaveBeenCalled();
});
it('forwards native rotation data and ignores duplicate callbacks', () => {
  jest
    .spyOn(useAppPreferencesStore.persist, 'hasHydrated')
    .mockReturnValue(true);
  jest.mocked(remoteInvitationsEligible).mockReturnValue(true);
  let onToken: ((token: Notifications.DevicePushToken) => void) | undefined;
  jest
    .spyOn(Notifications, 'addPushTokenListener')
    .mockImplementation((listener) => {
      onToken = listener;
      return { remove: jest.fn() };
    });
  renderHook(() => useChallengeSurfaces(true));
  const first = { type: 'ios' as const, data: 'native-test-value' };
  act(() => {
    onToken!(first);
    onToken!({ ...first });
  });
  expect(remotePushRegistration.reconcile).toHaveBeenCalledTimes(2);
  expect(remotePushRegistration.reconcile).toHaveBeenLastCalledWith(
    expect.objectContaining({ account: snapshot.accountKey }),
    first
  );
  const changed = { ...first, data: 'rotated-native-test-value' };
  act(() => onToken!(changed));
  expect(remotePushRegistration.reconcile).toHaveBeenCalledTimes(3);
  expect(remotePushRegistration.reconcile).toHaveBeenLastCalledWith(
    expect.objectContaining({ account: snapshot.accountKey }),
    changed
  );
});

it('republishes unit preference changes without changing source freshness', async () => {
  const changed = JSON.parse(
    JSON.stringify(snapshot)
  ) as CompanionChallengeSnapshot;
  changed.version = 3;
  changed.items[0].metric = 'distance';
  changed.items[0].scoringMode = 'sum';
  changed.items[0].scoreUnit = 'meters';
  changed.items[0].rows.forEach((row) => {
    row.total = 1609.34;
    row.daysWithData = 1;
  });
  jest.mocked(useCompanionChallenges).mockReturnValue(state(changed));
  renderHook(() => useChallengeSurfaces(true));
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].score).toContain('km')
  );
  act(() => {
    client.setQueryData(preferencesQueryKey, {
      default_distance_unit: 'miles',
    });
  });
  await waitFor(() =>
    expect(publish.mock.calls.at(-1)?.[0].score).toBe('1 mi')
  );
  expect(publish.mock.calls.at(-1)?.[0].generatedAt).toBe(changed.generatedAt);
});
