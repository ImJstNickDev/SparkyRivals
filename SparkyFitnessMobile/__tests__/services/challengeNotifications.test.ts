import { remotePushRegistration } from '../../src/services/remotePushRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ChallengeNotificationReconciler } from '../../src/services/challengeNotifications';
import {
  CHALLENGE_NOTIFICATION_DEFAULTS,
  emptyChallengeLedger,
} from '../../src/services/challengeNotificationPlan';
import {
  getCompanionChallengeSession,
  invalidateCompanionChallengeSession,
} from '../../src/services/companionChallengeSession';
import { getActiveServerConfigId } from '../../src/services/storage';
import { getNotificationPermissionStatus } from '../../src/services/notifications';
import { challenge, actor, results } from '../helpers/challenges';
import {
  buildCompanionChallenges,
  emptyCompanionChallenges,
} from '../../src/utils/companionChallenges';
import i18n from '../../src/localization/i18n';
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfigId: jest.fn(),
}));
jest.mock('../../src/services/notifications', () => ({
  getNotificationPermissionStatus: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('../../src/services/remotePushRegistration', () => ({
  remotePushRegistration: {
    settled: jest.fn(async () => {}),
    isActive: jest.fn(() => false),
  },
}));
const api = jest.mocked(Notifications);
const now = Date.parse('2026-10-04T12:00Z');
const snapshot = buildCompanionChallenges({
  accountKey: 'config:' + actor,
  actor,
  challenges: [challenge],
  listUpdatedAt: now,
  hasMore: false,
  results: new Map([[challenge.id, { data: results, dataUpdatedAt: now }]]),
});
const input = () => ({
  snapshot,
  challenges: [challenge],
  freshList: true,
  freshResultIds: [],
  preferences: { ...CHALLENGE_NOTIFICATION_DEFAULTS, enabled: true },
  previous: emptyChallengeLedger(),
  now,
});
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(remotePushRegistration.isActive).mockReturnValue(false);
  await AsyncStorage.clear();
  invalidateCompanionChallengeSession(false);
  jest.mocked(getActiveServerConfigId).mockResolvedValue('config');
  jest.mocked(getNotificationPermissionStatus).mockResolvedValue('granted');
  api.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  api.getPresentedNotificationsAsync.mockResolvedValue([]);
  api.setNotificationCategoryAsync.mockImplementation(
    async (identifier, actions) => {
      if (Platform.OS === 'android' && actions.length === 0)
        throw new Error('Android categories require at least one action');
      return { identifier, actions };
    }
  );
});
afterEach(() => jest.restoreAllMocks());
const run = (service: ChallengeNotificationReconciler, value = input()) =>
  service.reconcile(
    value,
    getCompanionChallengeSession().revision,
    'config',
    i18n.t
  );
it('persists account-scoped invitation dedupe across reconcilers', async () => {
  const error = jest.fn();
  const service = new ChallengeNotificationReconciler(error);
  await run(service);
  const pending = {
    ...input(),
    challenges: [{ ...challenge, my_membership: 'pending' as const }],
  };
  await run(service, pending);
  expect(
    api.scheduleNotificationAsync.mock.calls.filter(([a]) => a.trigger === null)
  ).toHaveLength(1);
  await run(new ChallengeNotificationReconciler(error), pending);
  expect(
    api.scheduleNotificationAsync.mock.calls.filter(([a]) => a.trigger === null)
  ).toHaveLength(1);
  expect(error).not.toHaveBeenCalled();
});
it('schedules Android local invitations and reminders without an empty action category', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const error = jest.fn();
  const service = new ChallengeNotificationReconciler(error);
  await run(service, {
    ...input(),
    challenges: [{ ...challenge, lifecycle: 'upcoming' as const }],
  });
  expect(api.scheduleNotificationAsync).toHaveBeenCalled();
  await run(service, {
    ...input(),
    challenges: [{ ...challenge, my_membership: 'pending' as const }],
  });
  expect(api.setNotificationChannelAsync).toHaveBeenCalledWith(
    'challenges',
    expect.objectContaining({
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  );
  expect(api.setNotificationCategoryAsync).not.toHaveBeenCalled();
  const invitations = api.scheduleNotificationAsync.mock.calls.filter(([a]) =>
    a.identifier?.endsWith(':invitation')
  );
  expect(invitations).toHaveLength(1);
  expect(invitations[0][0].trigger).toEqual({ channelId: 'challenges' });
  expect(error).not.toHaveBeenCalled();
});
it('denied OS permission never schedules or asks for permission', async () => {
  jest.mocked(getNotificationPermissionStatus).mockResolvedValue('denied');
  await run(new ChallengeNotificationReconciler(jest.fn()));
  expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it.each(['cancelled', 'completed'] as const)(
  'removes obsolete schedules for %s',
  async (lifecycle) => {
    api.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'sparky-challenge:old', content: { data: {} } },
      { identifier: 'medication', content: { data: {} } },
    ] as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >);
    await run(new ChallengeNotificationReconciler(jest.fn()), {
      ...input(),
      challenges: [{ ...challenge, lifecycle }],
    });
    expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'sparky-challenge:old'
    );
    expect(api.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'medication'
    );
  }
);
it('logout cancels scheduled and dismisses delivered account information', async () => {
  api.getAllScheduledNotificationsAsync.mockResolvedValue([
    { identifier: 'sparky-challenge:old', content: { data: {} } },
  ] as Awaited<
    ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
  >);
  api.getPresentedNotificationsAsync.mockResolvedValue([
    {
      request: {
        identifier: 'sparky-challenge:old',
        content: { data: { accountKey: 'old' } },
      },
    },
  ] as Awaited<
    ReturnType<typeof Notifications.getPresentedNotificationsAsync>
  >);
  invalidateCompanionChallengeSession(true);
  await run(new ChallengeNotificationReconciler(jest.fn()), {
    ...input(),
    snapshot: emptyCompanionChallenges(),
  });
  expect(api.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'sparky-challenge:old'
  );
  expect(api.dismissNotificationAsync).toHaveBeenCalledWith(
    'sparky-challenge:old'
  );
});
it('old inflight permission read cannot schedule after switching account', async () => {
  let resolve!: (value: 'granted') => void;
  jest.mocked(getNotificationPermissionStatus).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const task = run(new ChallengeNotificationReconciler(jest.fn()));
  for (let i = 0; i < 20 && !resolve; i++) await Promise.resolve();
  invalidateCompanionChallengeSession(true);
  resolve('granted');
  await task;
  expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
});
it('same OS schedule is not recreated; failure is reported without changing queries', async () => {
  const error = jest.fn();
  const service = new ChallengeNotificationReconciler(error);
  await run(service);
  const scheduled = api.scheduleNotificationAsync.mock.calls.map(([a]) => a);
  api.getAllScheduledNotificationsAsync.mockResolvedValue(
    scheduled as Awaited<
      ReturnType<typeof Notifications.getAllScheduledNotificationsAsync>
    >
  );
  api.scheduleNotificationAsync.mockClear();
  await run(service);
  expect(api.scheduleNotificationAsync).not.toHaveBeenCalled();
  api.getAllScheduledNotificationsAsync.mockRejectedValueOnce(
    new Error('native unavailable')
  );
  await run(service);
  expect(error).toHaveBeenCalledTimes(1);
});

it.each([
  ['ios', true],
  ['ios', false],
  ['android', true],
  ['android', false],
] as const)(
  '%s remote registration %s selects exactly one invitation alert source',
  async (platform, registered) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const service = new ChallengeNotificationReconciler(jest.fn());
    await run(service);
    api.scheduleNotificationAsync.mockClear();
    jest.mocked(remotePushRegistration.isActive).mockReturnValue(registered);
    const pending = {
      ...input(),
      challenges: [{ ...challenge, my_membership: 'pending' as const }],
    };
    await run(service, pending);
    expect(
      api.scheduleNotificationAsync.mock.calls.filter(([n]) =>
        n.identifier?.endsWith(':invitation')
      )
    ).toHaveLength(registered ? 0 : 1);
    jest.mocked(remotePushRegistration.isActive).mockReturnValue(false);
    await run(service, pending);
    expect(
      api.scheduleNotificationAsync.mock.calls.filter(([n]) =>
        n.identifier?.endsWith(':invitation')
      )
    ).toHaveLength(registered ? 0 : 1);
  }
);
it('waits for registration in flight before planning a fresh invitation', async () => {
  const service = new ChallengeNotificationReconciler(jest.fn());
  await run(service);
  api.scheduleNotificationAsync.mockClear();
  jest
    .mocked(remotePushRegistration.settled)
    .mockImplementationOnce(async () => {
      jest.mocked(remotePushRegistration.isActive).mockReturnValue(true);
    });
  await run(service, {
    ...input(),
    challenges: [{ ...challenge, my_membership: 'pending' as const }],
  });
  expect(
    api.scheduleNotificationAsync.mock.calls.filter(([n]) => n.trigger === null)
  ).toHaveLength(0);
});
it('remote invitations do not remove local start/end reminders', async () => {
  jest.mocked(remotePushRegistration.isActive).mockReturnValue(true);
  await run(new ChallengeNotificationReconciler(jest.fn()));
  expect(
    api.scheduleNotificationAsync.mock.calls.some(([n]) => n.trigger !== null)
  ).toBe(true);
});
