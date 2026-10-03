import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import WearConnectivity from '../../modules/wear-connectivity';
import { useCompanionChallenges } from './useCompanionChallenges';
import { WearChallengePublisher } from '../services/wearChallengePublisher';
import { getActiveServerConfigId } from '../services/storage';
import {
  getCompanionChallengeSession,
  subscribeCompanionChallengeSession,
} from '../services/companionChallengeSession';
import { emptyCompanionChallenges } from '../utils/companionChallenges';
import { addLog } from '../services/LogService';

/** Headless Android companion. Apple still publishes only its composed context. */
export function useWearChallenges(connected: boolean) {
  const { snapshot, refresh, sessionRevision, configId } =
    useCompanionChallenges(connected, WearConnectivity !== null);
  const publisher = useMemo(
    () =>
      WearConnectivity
        ? new WearChallengePublisher(
            (json) => WearConnectivity!.publishSnapshot(json),
            getActiveServerConfigId,
            () => {
              void addLog(
                'Wear Challenge state could not be queued; retry on foreground.',
                'WARNING'
              );
            }
          )
        : null,
    []
  );
  useEffect(() => {
    if (!publisher) return;
    const clear = () => {
      void publisher.offer(
        emptyCompanionChallenges(),
        getCompanionChallengeSession().revision
      );
    };
    clear();
    return subscribeCompanionChallengeSession(clear);
  }, [publisher]);
  useEffect(() => {
    if (publisher) void publisher.offer(snapshot, sessionRevision, configId);
  }, [publisher, snapshot, sessionRevision, configId]);
  useEffect(() => {
    if (!publisher) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      void publisher.offer(snapshot, sessionRevision, configId);
    });
    return () => listener.remove();
  }, [publisher, refresh, snapshot, sessionRevision, configId]);
}
