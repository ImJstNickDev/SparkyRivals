import {
  remotePushRegistration,
  remoteInvitationsEligible,
} from '../services/remotePushRegistration';
import { useQueryClient } from '@tanstack/react-query';
import { usePreferences } from './usePreferences';
import { preferencesQueryKey } from './queryKeys';
import type { UserPreferences } from '../types/preferences';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import translation from '../localization/i18n';
import { useCompanionChallenges } from './useCompanionChallenges';
import { buildChallengeWidget } from '../utils/challengeSurface';
import { publishChallengeWidget } from '../services/challengeWidgetPublisher';
import { CompanionChallengePublisher } from '../services/companionChallengePublisher';
import { ChallengeNotificationReconciler } from '../services/challengeNotifications';
import {
  CHALLENGE_NOTIFICATION_DEFAULTS,
  emptyChallengeLedger,
} from '../services/challengeNotificationPlan';
import { emptyCompanionChallenges } from '../utils/companionChallenges';
import { getActiveServerConfigId } from '../services/storage';
import {
  getCompanionChallengeSession,
  subscribeCompanionChallengeSession,
} from '../services/companionChallengeSession';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';
import { addLog } from '../services/LogService';
import type { CompanionChallengeSnapshot } from '../types/companionChallenges';

/** One cache observer fans out to phone widgets and local reminders. The existing
 * Apple/Wear observers use identical keys; TanStack deduplicates their requests. */
export function useChallengeSurfaces(connected: boolean) {
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';
  const {
    snapshot,
    widgetSnapshot,
    observation,
    refresh,
    sessionRevision,
    configId,
  } = useCompanionChallenges(connected, supported);
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const { preferences: displayPreferences } = usePreferences({
    enabled: connected && supported,
  });
  const presentationKey = JSON.stringify([
    i18n.language,
    displayPreferences?.default_distance_unit,
    displayPreferences?.energy_unit,
    displayPreferences?.water_display_unit,
  ]);

  const preferences = useAppPreferencesStore((s) => s.challengeNotifications);
  const master = useAppPreferencesStore((s) => s.notificationsEnabled);
  const hydrated = useSyncExternalStore(
    useAppPreferencesStore.persist.onFinishHydration,
    useAppPreferencesStore.persist.hasHydrated
  );
  const widget = useMemo(
    () =>
      new CompanionChallengePublisher(
        async (json) => {
          const value = JSON.parse(json) as CompanionChallengeSnapshot;
          const units =
            client.getQueryData<UserPreferences>(preferencesQueryKey);
          await publishChallengeWidget(
            buildChallengeWidget(
              value,
              translation.t.bind(translation),
              translation.language,
              {
                distance: units?.default_distance_unit,
                energy: units?.energy_unit,
                water: units?.water_display_unit,
              }
            )
          );
        },
        getActiveServerConfigId,
        () => {
          void addLog(
            'Challenge widget update failed; retry on refresh.',
            'WARNING'
          );
        }
      ),
    [client]
  );
  const notifications = useMemo(
    () =>
      new ChallengeNotificationReconciler(() => {
        void addLog(
          'Challenge notification reconciliation failed; retry on refresh.',
          'WARNING'
        );
      }),
    []
  );
  useEffect(() => {
    if (!supported) return;
    const clear = () => {
      const revision = getCompanionChallengeSession().revision;
      void widget.offer(emptyCompanionChallenges(), revision);
      void notifications.reconcile(
        {
          snapshot: emptyCompanionChallenges(),
          challenges: [],
          freshResultIds: [],
          freshList: false,
          preferences: { ...CHALLENGE_NOTIFICATION_DEFAULTS, enabled: false },
          previous: emptyChallengeLedger(),
          now: Date.now(),
        },
        revision,
        undefined,
        t
      );
    };
    clear();
    return subscribeCompanionChallengeSession(clear);
    // Subscriptions are session-level; preference changes reconcile below.
  }, [supported, widget, notifications, t]);
  useEffect(() => {
    if (!supported || !hydrated) return;
    const reconcile = (devicePushToken?: Notifications.DevicePushToken) => {
      if (
        !remoteInvitationsEligible() ||
        getCompanionChallengeSession().blocked
      )
        return remotePushRegistration.clear();
      // Initial query loading and transient offline state are not logout. Keep
      // the persisted binding available for a guarded cold notification tap.
      // Auth/storage transitions invalidate it synchronously through the barrier.
      if (snapshot.state !== 'ready') return;
      return remotePushRegistration.reconcile(
        {
          account: snapshot.accountKey,
          configId: configId ?? '',
          revision: sessionRevision,
          enabled: true,
        },
        devicePushToken
      );
    };
    void reconcile();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcile();
    });
    let lastNativeToken: string | undefined;
    const tokens = Notifications.addPushTokenListener((token) => {
      // Native registration can repeat the same callback without rotating its
      // token. Keep this comparison in memory; never log native routing values.
      const value = JSON.stringify(token);
      if (value === lastNativeToken) return;
      lastNativeToken = value;
      void reconcile(token);
    });
    return () => {
      foreground.remove();
      tokens.remove();
    };
  }, [
    supported,
    hydrated,
    configId,
    sessionRevision,
    snapshot.accountKey,
    snapshot.state,
    preferences,
    master,
  ]);
  useEffect(() => {
    if (!supported) return;
    void widget.offer(
      widgetSnapshot,
      sessionRevision,
      configId,
      presentationKey
    );
    if (hydrated)
      void notifications.reconcile(
        {
          snapshot,
          ...observation,
          preferences: {
            ...preferences,
            enabled: master && preferences.enabled,
          },
          previous: emptyChallengeLedger(),
          now: Date.now(),
        },
        sessionRevision,
        configId,
        t
      );
  }, [
    snapshot,
    sessionRevision,
    configId,
    observation,
    preferences,
    master,
    hydrated,
    t,
    presentationKey,
    widgetSnapshot,
    supported,
    widget,
    notifications,
  ]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => listener.remove();
  }, [refresh]);
}
