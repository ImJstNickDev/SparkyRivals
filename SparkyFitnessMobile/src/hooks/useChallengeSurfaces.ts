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
  const { snapshot, observation, refresh, sessionRevision, configId } =
    useCompanionChallenges(connected, supported);
  const { t, i18n } = useTranslation();

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
          await publishChallengeWidget(
            buildChallengeWidget(
              value,
              translation.t.bind(translation),
              translation.language
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
    []
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
    if (!supported) return;
    void widget.offer(snapshot, sessionRevision, configId, i18n.language);
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
    i18n.language,
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
