import { dayRangeToUtcRange, type ChallengeResponse } from '@workspace/shared';
import type { CompanionChallengeSnapshot } from '../types/companionChallenges';

export const CHALLENGE_NOTIFICATION_DEFAULTS = {
  enabled: false,
  invitations: true,
  start: true,
  endingSoon: true,
  ended: true,
  leadChanges: false,
};
export type ChallengeNotificationPreferences =
  typeof CHALLENGE_NOTIFICATION_DEFAULTS;
export type ChallengeAlertKind =
  'invitation' | 'start' | 'endingSoon' | 'ended' | 'lead';
export interface ChallengeAlert {
  key: string;
  id: string;
  name: string;
  kind: ChallengeAlertKind;
  at?: number;
}
export interface ChallengeNotificationLedger {
  enabled: boolean;
  seen: Record<string, number>;
  leaders: Record<
    string,
    { state: string; verifiedAt: number; notifiedAt: number }
  >;
}
export const emptyChallengeLedger = (): ChallengeNotificationLedger => ({
  enabled: false,
  seen: {},
  leaders: {},
});

/** Pure local plan. Boundaries are instants in the Challenge zone; results stay authoritative. */
export function planChallengeNotifications(input: {
  challenges: readonly ChallengeResponse[];
  snapshot: CompanionChallengeSnapshot;
  freshResultIds: readonly string[];
  freshList: boolean;
  remoteInvitations?: boolean;
  preferences: ChallengeNotificationPreferences;
  previous: ChallengeNotificationLedger;
  now: number;
}) {
  const { preferences: prefs, previous, now, snapshot } = input;
  const ledger: ChallengeNotificationLedger = {
    enabled: prefs.enabled && (previous.enabled || input.freshList),
    seen: { ...previous.seen },
    leaders: { ...previous.leaders },
  };
  const alerts: ChallengeAlert[] = [];
  for (const c of input.challenges) {
    if (c.my_membership === 'pending' && input.freshList) {
      if (
        prefs.enabled &&
        previous.enabled &&
        prefs.invitations &&
        !input.remoteInvitations &&
        !ledger.seen[c.id] &&
        ['active', 'upcoming'].includes(c.lifecycle)
      )
        alerts.push({
          key: `${c.id}:invitation`,
          id: c.id,
          name: c.name,
          kind: 'invitation',
        });
      ledger.seen[c.id] = now;
    }
    if (
      !prefs.enabled ||
      c.my_membership !== 'accepted' ||
      !['active', 'upcoming'].includes(c.lifecycle)
    )
      continue;
    const { start, end } = dayRangeToUtcRange(
      c.start_date,
      c.end_date,
      c.timezone
    );
    const endingSoon = end.getTime() - 24 * 60 * 60_000;
    const boundaries = [
      { kind: 'start' as const, at: start.getTime(), enabled: prefs.start },
      {
        kind: 'endingSoon' as const,
        at: endingSoon,
        enabled: prefs.endingSoon && endingSoon > start.getTime(),
      },
      { kind: 'ended' as const, at: end.getTime(), enabled: prefs.ended },
    ];
    for (const event of boundaries)
      if (event.enabled && event.at > now)
        alerts.push({
          key: `${c.id}:${event.kind}:${event.at}`,
          id: c.id,
          name: c.name,
          kind: event.kind,
          at: event.at,
        });
  }
  for (const item of snapshot.items) {
    if (
      item.membership !== 'accepted' ||
      item.lifecycle !== 'active' ||
      !input.freshResultIds.includes(item.id) ||
      !item.calculatedAt
    )
      continue;
    const verifiedAt = Date.parse(item.calculatedAt);
    if (
      !Number.isFinite(verifiedAt) ||
      now - verifiedAt > 15 * 60_000 ||
      verifiedAt > now + 5 * 60_000
    )
      continue;
    const self = item.rows.find((r) => r.isSelf);
    if (!self || self.rank === undefined || (item.participantCount ?? 0) < 2)
      continue;
    const state = self.leader
      ? item.leadMargin === 0
        ? 'tied'
        : 'sole'
      : 'behind';
    const last = ledger.leaders[item.id];
    if (last && verifiedAt <= last.verifiedAt) continue;
    // Only transitions involving our lead matter. A five-minute cooldown absorbs
    // partial source refreshes; the observed baseline still advances during it.
    const notify =
      prefs.enabled &&
      previous.enabled &&
      prefs.leadChanges &&
      last &&
      last.state !== state &&
      (state !== 'behind' || last.state !== 'behind') &&
      now - last.notifiedAt >= 5 * 60_000;
    if (notify)
      alerts.push({
        key: `${item.id}:lead:${verifiedAt}:${state}`,
        id: item.id,
        name: item.name,
        kind: 'lead',
      });
    ledger.leaders[item.id] = {
      state,
      verifiedAt,
      notifiedAt: notify ? now : (last?.notifiedAt ?? 0),
    };
  }
  ledger.seen = Object.fromEntries(
    Object.entries(ledger.seen)
      .filter(([, time]) => now - time < 90 * 86400_000)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
  );
  ledger.leaders = Object.fromEntries(
    Object.entries(ledger.leaders)
      .sort((a, b) => b[1].verifiedAt - a[1].verifiedAt)
      .slice(0, 100)
  );
  // Leave room for upstream fasting/medication/rest alerts in iOS's OS limit.
  const scheduled = alerts
    .filter((a) => a.at)
    .sort((a, b) => a.at! - b.at! || a.key.localeCompare(b.key))
    .slice(0, 24);
  return {
    ledger,
    alerts: [...alerts.filter((a) => !a.at).slice(0, 3), ...scheduled],
  };
}
