// Preserve Apple consumers while sharing presentation selection with Wear OS.
export {
  emptyCompanionChallenges as emptyWatchChallenges,
  selectCompanionChallenges as selectWatchChallenges,
  buildCompanionChallenges as buildWatchChallenges,
} from './companionChallenges';
export type { CompanionChallengeResult as WatchChallengeResult } from './companionChallenges';
