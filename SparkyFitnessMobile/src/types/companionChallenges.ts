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
  today?: { date: string; value: number; present: boolean; eligible: boolean };
  daysWithSteps: number;
  eligibleDays: number;
}
export interface CompanionChallengeItem {
  id: string;
  name: string;
  lifecycle: 'upcoming' | 'active' | 'completed';
  membership: 'pending' | 'accepted';
  startDate: string;
  endDate: string;
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
  version: 1;
  /** Local config id + authenticated user id, never server URL/token. */
  accountKey: string;
  state: 'unavailable' | 'ready';
  /** Oldest included successful query timestamp in epoch ms, not push time. */
  generatedAt: number;
  items: CompanionChallengeItem[];
  hasMore: boolean;
}
