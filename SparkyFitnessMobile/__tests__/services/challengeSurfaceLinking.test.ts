import {
  remotePushRegistration,
  remoteInvitationsEligible,
} from '../../src/services/remotePushRegistration';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { challengeSurfaceLinking } from '../../src/services/challengeSurfaceLinking';
import { getChallengeSurfaceUrl } from '../../src/utils/challengeSurfaceLinks';
import { invalidateCompanionChallengeSession } from '../../src/services/companionChallengeSession';
import { getActiveServerConfigId } from '../../src/services/storage';
import { queryClient } from '../../src/hooks/queryClient';
import { actor, challenge } from '../helpers/challenges';
jest.mock('../../src/hooks/queryClient', () => ({
  queryClient: { fetchQuery: jest.fn() },
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
jest.mock('../../src/services/api/profileApi', () => ({
  fetchProfile: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { name: 'test', slug: 'test', scheme: 'sparkyrivals' },
  },
}));
jest.mock('../../src/services/remotePushRegistration', () => ({
  remotePushRegistration: { accountForGuard: jest.fn() },
  remoteInvitationsEligible: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  invalidateCompanionChallengeSession(false);
  jest.mocked(getActiveServerConfigId).mockResolvedValue('config');
  jest.mocked(queryClient.fetchQuery).mockResolvedValue({ id: actor });
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest
    .mocked(Notifications.getLastNotificationResponseAsync)
    .mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());
it.each([
  'sparkyfitnessmobile',
  'sparkyrivals-dev',
  'sparkyrivals-preview',
  'sparkyrivals',
])('opens a guarded %s widget link on cold launch', async (scheme) => {
  jest.replaceProperty(Constants, 'expoConfig', {
    name: 'test',
    slug: 'test',
    scheme,
  });
  const url = getChallengeSurfaceUrl(challenge.id, `config:${actor}`);
  jest.mocked(Linking.getInitialURL).mockResolvedValue(url);
  expect(await challengeSurfaceLinking.getInitialURL()).toBe(url);
});
it('consumes a Challenge notification response once', async () => {
  const url = getChallengeSurfaceUrl(challenge.id, `config:${actor}`);
  jest
    .mocked(Notifications.getLastNotificationResponseAsync)
    .mockResolvedValue({
      notification: {
        request: { content: { data: { type: 'challenge', url } } },
      },
    } as Notifications.NotificationResponse);
  expect(await challengeSurfaceLinking.getInitialURL()).toBe(url);
  expect(
    Notifications.clearLastNotificationResponseAsync
  ).toHaveBeenCalledTimes(1);
});
it('rejects old-account, malformed and logged-out links', async () => {
  for (const url of [
    getChallengeSurfaceUrl(challenge.id, 'other:actor'),
    getChallengeSurfaceUrl('bad', `config:${actor}`),
  ]) {
    jest.mocked(Linking.getInitialURL).mockResolvedValue(url);
    expect(await challengeSurfaceLinking.getInitialURL()).toBeNull();
  }
  invalidateCompanionChallengeSession(true);
  jest
    .mocked(Linking.getInitialURL)
    .mockResolvedValue(getChallengeSurfaceUrl(challenge.id, `config:${actor}`));
  expect(await challengeSurfaceLinking.getInitialURL()).toBeNull();
});
it('rejects a profile resolution crossing an account switch', async () => {
  jest
    .mocked(Linking.getInitialURL)
    .mockResolvedValue(getChallengeSurfaceUrl(challenge.id, `config:${actor}`));
  jest.mocked(queryClient.fetchQuery).mockImplementationOnce(async () => {
    invalidateCompanionChallengeSession(false);
    return { id: actor };
  });
  expect(await challengeSurfaceLinking.getInitialURL()).toBeNull();
});
it('preserves existing workout/auth links without Challenge queries', async () => {
  jest
    .mocked(Linking.getInitialURL)
    .mockResolvedValue('sparkyrivals://active-workout');
  expect(await challengeSurfaceLinking.getInitialURL()).toBe(
    'sparkyrivals://active-workout'
  );
  expect(queryClient.fetchQuery).not.toHaveBeenCalled();
});

it('forwards a verified foreground notification and releases both subscriptions', async () => {
  let response!: (value: Notifications.NotificationResponse) => void;
  const removeNotifications = jest.fn();
  const removeLinks = jest.fn();
  jest
    .mocked(Notifications.addNotificationResponseReceivedListener)
    .mockImplementation((callback) => {
      response = callback;
      return { remove: removeNotifications };
    });
  jest
    .spyOn(Linking, 'addEventListener')
    .mockReturnValue({ remove: removeLinks });
  const listener = jest.fn();
  const cleanup = challengeSurfaceLinking.subscribe(listener);
  const url = getChallengeSurfaceUrl(challenge.id, `config:${actor}`);
  response({
    notification: {
      request: { content: { data: { type: 'challenge', url } } },
    },
  } as Notifications.NotificationResponse);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(listener).toHaveBeenCalledWith(url);
  cleanup();
  expect(removeNotifications).toHaveBeenCalled();
  expect(removeLinks).toHaveBeenCalled();
});

const remoteResponse = (extra = {}) =>
  ({
    notification: {
      request: {
        content: {
          data: {
            type: 'challenge_invitation',
            challengeId: challenge.id,
            eventId: '10000000-0000-4000-8000-000000000001',
            accountGuard: '10000000-0000-4000-8000-000000000002',
            ...extra,
          },
        },
      },
    },
  }) as Notifications.NotificationResponse;
it('constructs remote invitation destinations locally after consent/account verification', async () => {
  jest.mocked(remoteInvitationsEligible).mockReturnValue(true);
  jest
    .mocked(remotePushRegistration.accountForGuard)
    .mockResolvedValue(`config:${actor}`);
  jest
    .mocked(Notifications.getLastNotificationResponseAsync)
    .mockResolvedValue(remoteResponse());
  const remoteUrl = await challengeSurfaceLinking.getInitialURL();
  expect(remoteInvitationsEligible).toHaveBeenCalled();
  expect(remotePushRegistration.accountForGuard).toHaveBeenCalled();
  expect(remoteUrl).toBe(
    getChallengeSurfaceUrl(challenge.id, `config:${actor}`)
  );
});
it.each(['consent', 'guard', 'account', 'url', 'id', 'storage'])(
  'fails closed on remote %s mismatch',
  async (reason) => {
    jest
      .mocked(remoteInvitationsEligible)
      .mockReturnValue(reason !== 'consent');
    jest
      .mocked(remotePushRegistration.accountForGuard)
      .mockResolvedValue(
        reason === 'guard'
          ? null
          : reason === 'account'
            ? 'other:actor'
            : `config:${actor}`
      );
    if (reason === 'storage')
      jest
        .mocked(remotePushRegistration.accountForGuard)
        .mockRejectedValueOnce(new Error('unavailable'));
    jest
      .mocked(Notifications.getLastNotificationResponseAsync)
      .mockResolvedValue(
        remoteResponse(
          reason === 'url'
            ? { url: 'https://untrusted.test' }
            : reason === 'id'
              ? { challengeId: '../unsafe' }
              : {}
        )
      );
    expect(await challengeSurfaceLinking.getInitialURL()).toBeNull();
  }
);
