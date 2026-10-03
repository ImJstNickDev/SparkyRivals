import { useWatchConnectivity } from './useWatchConnectivity';
import { useCompanionChallenges } from './useCompanionChallenges';

export function useWatchChallenges(connected: boolean) {
  const link = useWatchConnectivity();
  return useCompanionChallenges(connected, link.isSupported && link.isPaired);
}
