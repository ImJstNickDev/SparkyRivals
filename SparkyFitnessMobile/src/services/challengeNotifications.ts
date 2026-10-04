import { remotePushRegistration } from './remotePushRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { TFunction } from 'i18next';
import { z } from 'zod';
import { getNotificationPermissionStatus } from './notifications';
import { getCompanionChallengeSession } from './companionChallengeSession';
import { getActiveServerConfigId } from './storage';
import { getChallengeSurfaceUrl } from '../utils/challengeSurfaceLinks';
import {
  emptyChallengeLedger,
  planChallengeNotifications,
  type ChallengeAlertKind,
} from './challengeNotificationPlan';

const PREFIX = 'sparky-challenge:';
const KEY = '@SparkyFitness/challenge-notification-ledgers-v1';
const ledgerSchema = z.record(
  z.string(),
  z.object({
    enabled: z.boolean(),
    seen: z.record(z.string(), z.number()),
    leaders: z.record(
      z.string(),
      z.object({
        state: z.string(),
        verifiedAt: z.number(),
        notifiedAt: z.number(),
      })
    ),
  })
);
type PlanInput = Parameters<typeof planChallengeNotifications>[0];
export class ChallengeNotificationReconciler {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly onError: () => void) {}
  reconcile(
    input: PlanInput,
    revision: number,
    configId: string | undefined,
    t: TFunction
  ) {
    this.queue = this.queue
      .then(async () => {
        const session = getCompanionChallengeSession();
        const valid = () =>
          !session.blocked &&
          getCompanionChallengeSession() === session &&
          session.revision === revision;
        const account = input.snapshot.accountKey;
        const permitted =
          input.snapshot.state === 'ready' &&
          valid() &&
          !!configId &&
          configId === (await getActiveServerConfigId()) &&
          valid();
        const current = await Notifications.getAllScheduledNotificationsAsync();
        if (!permitted) {
          for (const notification of current)
            if (notification.identifier.startsWith(PREFIX))
              await Notifications.cancelScheduledNotificationAsync(
                notification.identifier
              );
          await dismissOtherAccounts('');
          return;
        }
        const stored = await AsyncStorage.getItem(KEY);
        let parsed: unknown;
        try {
          parsed = stored ? JSON.parse(stored) : {};
        } catch {
          parsed = {};
        }
        const ledgers = ledgerSchema.safeParse(parsed).data ?? {};
        const permission = await getNotificationPermissionStatus();
        if (!valid()) return;
        await remotePushRegistration.settled();
        if (!valid()) return;
        const plan = planChallengeNotifications({
          ...input,
          remoteInvitations: remotePushRegistration.isActive(account),
          preferences: {
            ...input.preferences,
            enabled: input.preferences.enabled && permission === 'granted',
          },
          previous: ledgers[account] ?? emptyChallengeLedger(),
        });
        // Persist observation before immediate delivery: at most once on crash/retry.
        // The OS's scheduled request list is authoritative for future reminders.
        delete ledgers[account];
        ledgers[account] = plan.ledger;
        await AsyncStorage.setItem(
          KEY,
          JSON.stringify(Object.fromEntries(Object.entries(ledgers).slice(-5)))
        );
        const idFor = (key: string) =>
          `${PREFIX}${encodeURIComponent(account)}:${key}`;
        const wanted = new Set(
          plan.alerts.filter((a) => a.at).map((a) => idFor(a.key))
        );
        for (const notification of current)
          if (
            notification.identifier.startsWith(PREFIX) &&
            !wanted.has(notification.identifier)
          )
            await Notifications.cancelScheduledNotificationAsync(
              notification.identifier
            );
        await dismissOtherAccounts(account);
        if (!valid()) return;
        if (Platform.OS === 'android')
          await Notifications.setNotificationChannelAsync('challenges', {
            name: t('challenges.title', { defaultValue: 'Challenges' }),
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        await Notifications.setNotificationCategoryAsync('challenge', []);
        const messages: Record<ChallengeAlertKind, string> = {
          invitation: t('challenges.notifications.invitationBody', {
            defaultValue:
              'You have a new invitation. Open to review and choose whether to join.',
          }),
          start: t('challenges.notifications.startBody', {
            defaultValue: 'Your Challenge starts today. Keep moving together.',
          }),
          endingSoon: t('challenges.notifications.endingSoonBody', {
            defaultValue: 'One day left. Open to see the latest progress.',
          }),
          ended: t('challenges.notifications.endedBody', {
            defaultValue: 'Challenge finished — open to see the latest result.',
          }),
          lead: t('challenges.notifications.leadBody', {
            defaultValue:
              'Your position at the lead changed. Open to see the refreshed result.',
          }),
        };
        for (const alert of plan.alerts) {
          const identifier = idFor(alert.key);
          if (!valid()) break;
          if (
            alert.kind === 'invitation' &&
            remotePushRegistration.isActive(account)
          )
            continue;
          if (alert.at && current.some((n) => n.identifier === identifier))
            continue;
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: alert.name,
              body: messages[alert.kind],
              categoryIdentifier: 'challenge',
              data: {
                type: 'challenge',
                accountKey: account,
                url: getChallengeSurfaceUrl(alert.id, account),
              },
            },
            trigger: alert.at
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: new Date(alert.at),
                  channelId: 'challenges',
                }
              : Platform.OS === 'android'
                ? { channelId: 'challenges' }
                : null,
          });
          if (!valid())
            await Notifications.cancelScheduledNotificationAsync(identifier);
        }
      })
      .catch(this.onError);
    return this.queue;
  }
}
async function dismissOtherAccounts(account: string) {
  for (const notification of await Notifications.getPresentedNotificationsAsync())
    if (
      notification.request.identifier.startsWith(PREFIX) &&
      notification.request.content.data?.accountKey !== account
    )
      await Notifications.dismissNotificationAsync(
        notification.request.identifier
      );
}
