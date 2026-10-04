import i18n from '../../src/localization/i18n';
import english from '../../src/localization/locales/en/translation.json';
import {
  buildChallengeWidget,
  selectPrimaryChallengeSurface,
} from '../../src/utils/challengeSurface';
import {
  buildCompanionChallenges,
  emptyCompanionChallenges,
} from '../../src/utils/companionChallenges';
import {
  actor,
  challenge,
  results,
  workoutResults,
  goalResults,
} from '../helpers/challenges';
import {
  getChallengeSurfaceUrl,
  isChallengeSurfaceLinkAllowed,
} from '../../src/utils/challengeSurfaceLinks';
beforeAll(() =>
  i18n.addResourceBundle('en', 'translation', english, true, true)
);
const snapshot = (workout = false) =>
  buildCompanionChallenges({
    accountKey: 'config:' + actor,
    actor,
    challenges: [workout ? workoutResults.challenge : challenge],
    listUpdatedAt: 1000,
    hasMore: false,
    results: new Map([
      [
        challenge.id,
        { data: workout ? workoutResults : results, dataUpdatedAt: 1000 },
      ],
    ]),
  });
it('selects active before invitations, upcoming and completed deterministically', () => {
  const item = snapshot().items[0];
  expect(
    selectPrimaryChallengeSurface([
      { ...item, id: 'pending', membership: 'pending' },
      { ...item, id: 'future', lifecycle: 'upcoming' },
      item,
    ])?.id
  ).toBe(item.id);
  expect(
    selectPrimaryChallengeSurface([
      { ...item, id: 'z' },
      { ...item, id: 'a' },
    ])?.id
  ).toBe('a');
});
it.each([false, true])(
  'formats authoritative metric (workout=%s) and source freshness',
  (workout) => {
    const value = buildChallengeWidget(snapshot(workout), i18n.t, 'en');
    expect(value.generatedAt).toBe(1000);
    expect(value.rank).toBe('Rank 1 of 2');
    expect(value.score).toBe(workout ? '3h 42m' : '54,280 steps');
    expect(value.url).toContain('account=');
    expect(value).not.toHaveProperty('daily');
  }
);
it('zero differs from absent steps and workouts', () => {
  for (const workout of [false, true]) {
    const state = snapshot(workout);
    state.items[0].rows[0].total = 0;
    expect(buildChallengeWidget(state, i18n.t, 'en').score).toBe(
      workout ? '0m' : '0 steps'
    );
    state.items[0].rows[0].daysWithData = 0;
    state.items[0].rows[0].daysWithSteps = 0;
    expect(buildChallengeWidget(state, i18n.t, 'en').score).toBe(
      workout ? 'No workout recorded' : 'No step data'
    );
  }
});
it('pending and upcoming never expose scores', () => {
  for (const change of [
    { membership: 'pending' as const },
    { lifecycle: 'upcoming' as const },
  ]) {
    const state = snapshot();
    Object.assign(state.items[0], change);
    const value = buildChallengeWidget(state, i18n.t, 'en');
    expect(value.score).toBe('');
    expect(value.peer).toBe('');
  }
});
it('clear contains no previous account or score', () => {
  const value = buildChallengeWidget(emptyCompanionChallenges(), i18n.t, 'en');
  expect(value.accountKey).toBe('');
  expect(value.id).toBe('');
  expect(value.score).toBe('');
  expect(value.url).toBe('');
});
it('rejects stale-account and malformed links', () => {
  const url = getChallengeSurfaceUrl(challenge.id, 'accountA');
  expect(isChallengeSurfaceLinkAllowed(url, 'accountA')).toBe(true);
  expect(isChallengeSurfaceLinkAllowed(url, 'accountB')).toBe(false);
  expect(
    isChallengeSurfaceLinkAllowed(
      getChallengeSurfaceUrl('bad', 'accountA'),
      'accountA'
    )
  ).toBe(false);
});

it('formats one remaining day and calendar labels without shifting buckets', () => {
  const state = snapshot();
  state.items[0].daysRemaining = 1;
  expect(buildChallengeWidget(state, i18n.t, 'en').status).toBe(
    '1 day remaining'
  );
  state.items[0].lifecycle = 'upcoming';
  state.items[0].startDate = '2026-03-29';
  expect(buildChallengeWidget(state, i18n.t, 'en').status).toBe(
    'Starts Mar 29, 2026'
  );
});

it.each([
  ['steps', 'goal_progress', 'points', 140, '140 pts'],
  ['distance', 'sum', 'meters', 12400, '12.4 km'],
  ['active_calories', 'sum', 'kcal', 320, '320 kcal'],
  ['hydration', 'goal_days', 'goal_days', 2, '2 goal days'],
] as const)(
  'formats %s/%s explicitly on phone widgets',
  (metric, scoring_mode, scoreUnit, total, expected) => {
    const state = snapshot();
    state.version = 3;
    state.items[0] = {
      ...state.items[0],
      metric,
      scoringMode: scoring_mode,
      scoreUnit,
      rows: state.items[0].rows.map((row) => ({ ...row, total })),
    };
    expect(buildChallengeWidget(state, i18n.t, 'en').score).toBe(expected);
  }
);
it('lobby selection has no score and retains source freshness/account guard', () => {
  const challenge = {
    ...goalResults.challenge,
    lifecycle: 'lobby' as const,
    start_date: null,
    end_date: null,
    locked_at: null,
  };
  const state = buildCompanionChallenges({
    actor,
    accountKey: 'config:' + actor,
    challenges: [challenge],
    listUpdatedAt: 1000,
    hasMore: false,
    results: new Map(),
  });
  const widget = buildChallengeWidget(state, i18n.t, 'en');
  expect(widget.score).toBe('');
  expect(widget.status).toContain('Waiting for players');
  expect(widget.generatedAt).toBe(1000);
  expect(widget.url).toContain('account=');
});
