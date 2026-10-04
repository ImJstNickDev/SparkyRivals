import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  remotePushRegistration,
  remoteInvitationsEligible,
} from '../../src/services/remotePushRegistration';
import {
  getCompanionChallengeSession,
  invalidateCompanionChallengeSession,
} from '../../src/services/companionChallengeSession';
import { getActiveServerConfig } from '../../src/services/storage';
import { registerRemotePush } from '../../src/services/api/pushApi';
import { useAppPreferencesStore } from '../../src/stores/appPreferencesStore';
import {
  prepareRemotePushIdentityChange,
  resolveRemotePushAccount,
} from '../../src/services/remotePushIdentity';
import { initNotifications } from '../../src/services/notifications';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'test',
      slug: 'test',
      extra: {
        remotePushEnabled: true,
        eas: { projectId: '63f08cec-3f87-4cee-89be-bebf970b6262' },
      },
    },
  },
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../src/services/api/pushApi', () => ({
  registerRemotePush: jest.fn(),
  unregisterRemotePush: jest.fn(async () => null),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(async () => ({
    data: 'unit-test-routing-value',
  })),
  AndroidImportance: { DEFAULT: 3 },
}));
const account = 'config:actor';
const input = () => ({
  account,
  configId: 'config',
  revision: getCompanionChallengeSession().revision,
  enabled: remoteInvitationsEligible(),
});
beforeEach(async () => {
  invalidateCompanionChallengeSession(false);
  await remotePushRegistration.settled();
  jest.clearAllMocks();
  jest.mocked(getActiveServerConfig).mockResolvedValue({
    id: 'config',
    url: 'https://example.test',
    apiKey: 'unit-test-only',
  });
  jest.mocked(registerRemotePush).mockResolvedValue({
    enabled: true,
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  });
  useAppPreferencesStore.setState({
    notificationsEnabled: true,
    challengeNotifications: {
      enabled: true,
      invitations: true,
      start: true,
      endingSoon: true,
      ended: true,
      leadChanges: false,
    },
  });
});
afterEach(() => jest.restoreAllMocks());
it('settles an iOS acquisition callback without recursively requesting native tokens', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const native = { type: 'ios' as const, data: 'native-test-value' };
  let nativeRequests = 0;
  const getToken = jest.mocked(Notifications.getExpoPushTokenAsync);
  getToken.mockImplementation(async (options) => {
    if (!options?.devicePushToken) {
      nativeRequests++;
      // Bound a regression so the test fails instead of leaving an endless queue.
      if (nativeRequests > 3) throw new Error('Native token callback loop');
      void remotePushRegistration.reconcile(input(), native);
    }
    return { type: 'expo', data: 'unit-test-routing-value' };
  });
  await remotePushRegistration.reconcile(input());
  await remotePushRegistration.settled();
  expect(nativeRequests).toBe(1);
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(getToken).toHaveBeenLastCalledWith({
    projectId: '63f08cec-3f87-4cee-89be-bebf970b6262',
    devicePushToken: native,
  });
  expect(registerRemotePush).toHaveBeenCalledTimes(1);
  getToken.mockImplementation(async () => ({
    type: 'expo',
    data: 'unit-test-routing-value',
  }));
});
it.each(['ios', 'android'])(
  'uses the owned Expo project and secure storage on %s',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform as 'ios' | 'android');
    await remotePushRegistration.reconcile(input());
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: '63f08cec-3f87-4cee-89be-bebf970b6262',
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'sparkyrivals.remote-push.v1',
      expect.any(String),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
    );
    if (platform === 'android')
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'challenges',
        expect.any(Object)
      );
  }
);
it.each(['master', 'challenge', 'invitation'])(
  'does not register when %s consent is off',
  async (switchName) => {
    if (switchName === 'master')
      useAppPreferencesStore.setState({ notificationsEnabled: false });
    else
      useAppPreferencesStore.setState({
        challengeNotifications: {
          ...useAppPreferencesStore.getState().challengeNotifications,
          [switchName === 'challenge' ? 'enabled' : 'invitations']: false,
        },
      });
    await remotePushRegistration.reconcile(input());
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(registerRemotePush).not.toHaveBeenCalled();
  }
);
it('rejects an unexpected project before obtaining a routing token', async () => {
  jest.replaceProperty(Constants, 'expoConfig', {
    name: 'test',
    slug: 'test',
    extra: { remotePushEnabled: true, eas: { projectId: 'unowned' } },
  });
  await remotePushRegistration.reconcile(input());
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(registerRemotePush).not.toHaveBeenCalled();
});
it('invalidates remote foreground/tap guards synchronously before credential cleanup', async () => {
  await remotePushRegistration.reconcile(input());
  const guard = jest.mocked(registerRemotePush).mock.calls[0][1].account_guard;
  expect(await resolveRemotePushAccount(guard)).toBe(account);
  await prepareRemotePushIdentityChange();
  expect(await resolveRemotePushAccount(guard)).toBeNull();
});
it('foreground handler suppresses malformed or revoked remote state and preserves local notifications', async () => {
  await initNotifications();
  const handler = jest.mocked(Notifications.setNotificationHandler).mock
    .calls[0][0]!;
  const notification = (data: Record<string, unknown>) =>
    ({ request: { content: { data } } }) as Notifications.Notification;
  const remote = {
    type: 'challenge_invitation',
    challengeId: '10000000-0000-4000-8000-000000000001',
    eventId: '10000000-0000-4000-8000-000000000002',
    accountGuard: '10000000-0000-4000-8000-000000000003',
  };
  expect(await handler.handleNotification(notification(remote))).toMatchObject({
    shouldShowBanner: false,
    shouldPlaySound: false,
  });
  expect(
    await handler.handleNotification(notification({ type: 'rest-timer' }))
  ).toMatchObject({ shouldShowBanner: false });
});
