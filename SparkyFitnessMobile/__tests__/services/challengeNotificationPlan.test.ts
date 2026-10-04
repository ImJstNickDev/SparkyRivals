import {
  planChallengeNotifications,
  emptyChallengeLedger,
  CHALLENGE_NOTIFICATION_DEFAULTS,
} from '../../src/services/challengeNotificationPlan';
import { buildCompanionChallenges } from '../../src/utils/companionChallenges';
import { actor, results, challenge } from '../helpers/challenges';
const now = Date.parse('2026-10-04T12:00:00Z');
const snapshot = buildCompanionChallenges({
  accountKey: 'config:' + actor,
  actor,
  challenges: [challenge],
  listUpdatedAt: now,
  hasMore: false,
  results: new Map([[challenge.id, { data: results, dataUpdatedAt: now }]]),
});
const defaults = () => ({
  challenges: [challenge],
  snapshot,
  freshResultIds: [challenge.id],
  freshList: true,
  preferences: { ...CHALLENGE_NOTIFICATION_DEFAULTS, enabled: true },
  previous: { ...emptyChallengeLedger(), enabled: true },
  now,
});
it('new observed invitation alerts once, never shows scores', () => {
  const input = {
    ...defaults(),
    challenges: [{ ...challenge, my_membership: 'pending' as const }],
  };
  const first = planChallengeNotifications(input);
  expect(first.alerts.map((a) => a.kind)).toEqual(['invitation']);
  expect(
    planChallengeNotifications({ ...input, previous: first.ledger }).alerts
  ).toEqual([]);
});
it('initial opt-in baselines old invitations without a flood', () => {
  expect(
    planChallengeNotifications({
      ...defaults(),
      challenges: [{ ...challenge, my_membership: 'pending' }],
      previous: emptyChallengeLedger(),
    }).alerts
  ).toEqual([]);
});
it.each(['enabled', 'invitations'] as const)(
  'disabled %s observes without alert',
  (key) => {
    const input = {
      ...defaults(),
      challenges: [{ ...challenge, my_membership: 'pending' as const }],
      preferences: { ...defaults().preferences, [key]: false },
    };
    const plan = planChallengeNotifications(input);
    expect(plan.alerts).toEqual([]);
    expect(plan.ledger.seen[challenge.id]).toBe(now);
  }
);
it('cached invitation is not considered newly observed', () =>
  expect(
    planChallengeNotifications({
      ...defaults(),
      freshList: false,
      challenges: [{ ...challenge, my_membership: 'pending' }],
    }).alerts
  ).toEqual([]));
it.each([
  [
    'UTC',
    '2026-03-28',
    '2026-03-30',
    '2026-03-28T00:00:00.000Z',
    '2026-03-31T00:00:00.000Z',
  ],
  [
    'Europe/Rome',
    '2026-03-28',
    '2026-03-30',
    '2026-03-27T23:00:00.000Z',
    '2026-03-30T22:00:00.000Z',
  ],
  [
    'Europe/Rome',
    '2026-10-24',
    '2026-10-26',
    '2026-10-23T22:00:00.000Z',
    '2026-10-26T23:00:00.000Z',
  ],
])(
  'schedules actual %s boundaries %s to %s',
  (timezone, start_date, end_date, start, end) => {
    const plan = planChallengeNotifications({
      ...defaults(),
      now: Date.parse('2026-01-01T00:00Z'),
      challenges: [
        { ...challenge, timezone, start_date, end_date, lifecycle: 'upcoming' },
      ],
    });
    expect(plan.alerts.find((a) => a.kind === 'start')?.at).toBe(
      Date.parse(start)
    );
    expect(plan.alerts.find((a) => a.kind === 'ended')?.at).toBe(
      Date.parse(end)
    );
    expect(plan.alerts.find((a) => a.kind === 'endingSoon')?.at).toBe(
      Date.parse(end) - 86400_000
    );
  }
);
it('omits one-day UTC reminder at start', () => {
  const plan = planChallengeNotifications({
    ...defaults(),
    now: Date.parse('2026-01-01T00:00Z'),
    challenges: [
      {
        ...challenge,
        timezone: 'UTC',
        start_date: '2026-10-05',
        end_date: '2026-10-05',
      },
    ],
  });
  expect(plan.alerts.map((a) => a.kind)).toEqual(['start', 'ended']);
});
it.each(['cancelled', 'completed'] as const)(
  'does not schedule closed %s',
  (lifecycle) =>
    expect(
      planChallengeNotifications({
        ...defaults(),
        challenges: [{ ...challenge, lifecycle }],
        snapshot: { ...snapshot, items: [] },
      }).alerts
    ).toEqual([])
);
it.each(['declined', 'left'] as const)(
  'does not schedule for %s',
  (my_membership) =>
    expect(
      planChallengeNotifications({
        ...defaults(),
        challenges: [{ ...challenge, my_membership }],
        snapshot: { ...snapshot, items: [] },
      }).alerts
    ).toEqual([])
);
it('lead initial observation is silent; a new sole/tied/behind state alerts once', () => {
  const input = {
    ...defaults(),
    preferences: { ...defaults().preferences, leadChanges: true },
  };
  const first = planChallengeNotifications(input);
  expect(first.alerts.some((a) => a.kind === 'lead')).toBe(false);
  const corrected = {
    ...snapshot,
    items: snapshot.items.map((c) => ({
      ...c,
      calculatedAt: '2026-10-04T12:06:00Z',
      rows: c.rows.map((r) => ({ ...r, leader: !r.isSelf })),
    })),
  };
  const next = planChallengeNotifications({
    ...input,
    now: now + 360000,
    snapshot: corrected,
    previous: first.ledger,
  });
  expect(next.alerts.filter((a) => a.kind === 'lead')).toHaveLength(1);
  expect(
    planChallengeNotifications({
      ...input,
      now: now + 360000,
      snapshot: corrected,
      previous: next.ledger,
    }).alerts.filter((a) => a.kind === 'lead')
  ).toHaveLength(0);
});
it('cached/stale data cannot produce lead changes', () => {
  const previous = {
    ...emptyChallengeLedger(),
    enabled: true,
    leaders: {
      [challenge.id]: {
        state: 'behind',
        verifiedAt: now - 60000,
        notifiedAt: 0,
      },
    },
  };
  for (const input of [
    { ...defaults(), freshResultIds: [] },
    { ...defaults(), now: now + 3600000 },
  ])
    expect(
      planChallengeNotifications({
        ...input,
        previous,
        preferences: { ...input.preferences, leadChanges: true },
      }).alerts.filter((a) => a.kind === 'lead')
    ).toEqual([]);
});
it('caps future notifications and prunes old observed metadata', () => {
  const input = defaults();
  input.challenges = Array.from({ length: 100 }, (_, i) => ({
    ...challenge,
    id: String(i),
  }));
  input.previous.seen = { old: now - 91 * 86400_000 };
  const plan = planChallengeNotifications(input);
  expect(plan.alerts.length).toBeLessThanOrEqual(24);
  expect(plan.ledger.seen.old).toBeUndefined();
});

it('enabling against cached state waits for a fresh invitation baseline', () => {
  const input = {
    ...defaults(),
    freshList: false,
    previous: emptyChallengeLedger(),
    challenges: [{ ...challenge, my_membership: 'pending' as const }],
  };
  const cached = planChallengeNotifications(input);
  expect(cached.ledger.enabled).toBe(false);
  const fresh = planChallengeNotifications({
    ...input,
    freshList: true,
    previous: cached.ledger,
  });
  expect(fresh.alerts).toEqual([]);
  expect(fresh.ledger.seen[challenge.id]).toBe(now);
});

it('keeps lobby invitations local-fallback eligible without scheduling provisional lifecycle reminders', () => {
  const lobby = {
    ...challenge,
    scoring_mode: 'goal_progress' as const,
    lifecycle: 'lobby' as const,
    start_date: null,
    end_date: null,
    duration_days: 7,
    locked_at: null,
  };
  const accepted = planChallengeNotifications({
    ...defaults(),
    challenges: [lobby],
  });
  expect(accepted.alerts).toEqual([]);
  const pending = planChallengeNotifications({
    ...defaults(),
    challenges: [{ ...lobby, my_membership: 'pending' }],
  });
  expect(pending.alerts.map((alert) => alert.kind)).toEqual(['invitation']);
});
