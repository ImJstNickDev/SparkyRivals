import type {
  ChallengeMetric,
  ChallengeScoringMode,
  ChallengeScoreUnit,
} from '@workspace/shared';
/** Compact property-list wire contract. Omit unknown values; never send null,
 * credentials, daily history or a locally calculated score/rank. */
export interface CompanionChallengeRow {
  id: string;
  name: string;
  isSelf: boolean;
  total: number;
  rank?: number;
  tied: boolean;
  leader: boolean;
  gapToLeader?: number;
  today?: {
    date: string;
    value: number;
    present: boolean;
    eligible: boolean;
    workoutCount?: number;
  };
  daysWithSteps?: number;
  daysWithData?: number;
  workoutCount?: number;
  eligibleDays: number;
}
export interface CompanionChallengeItem {
  metric?: ChallengeMetric;
  scoringMode?: ChallengeScoringMode;
  scoreUnit?: ChallengeScoreUnit;
  /** Optional presentation-only unit. Older receivers safely ignore it. */
  displayUnit?: 'km' | 'mi' | 'kcal' | 'kJ' | 'ml' | 'L' | 'fl_oz';
  id: string;
  name: string;
  lifecycle: 'upcoming' | 'active' | 'completed' | 'lobby';
  membership: 'pending' | 'accepted';
  startDate?: string;
  endDate?: string;
  timezone: string;
  currentDay?: number;
  totalDays: number;
  daysRemaining: number;
  participantCount?: number;
  calculatedAt?: string;
  leadMargin?: number;
  rows: CompanionChallengeRow[];
}
export interface CompanionChallengeSnapshot {
  version: 1 | 2 | 3;
  /** Local config id + authenticated user id, never server URL/token. */
  accountKey: string;
  state: 'unavailable' | 'ready';
  /** Oldest included successful query timestamp in epoch ms, not push time. */
  generatedAt: number;
  items: CompanionChallengeItem[];
  hasMore: boolean;
}
