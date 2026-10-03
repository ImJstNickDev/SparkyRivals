import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
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
