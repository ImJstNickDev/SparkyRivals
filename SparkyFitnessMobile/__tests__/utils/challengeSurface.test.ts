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
    expect(value.score).toBe(workout ? '3.7 h' : '54,280 steps');
    expect(value.url).toContain('account=');
    expect(value).not.toHaveProperty('daily');
  }
);
it('zero differs from absent steps and workouts', () => {
  for (const workout of [false, true]) {
    const state = snapshot(workout);
    state.items[0].rows[0].total = 0;
    expect(buildChallengeWidget(state, i18n.t, 'en').score).toBe(
      workout ? '0 min' : '0 steps'
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
  ['steps', 'goal_progress', 'points', 140, '140 points'],
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

it.each([0, 4, 99])(
  'uses the actual adjacent server rows around position %i, not the leaders',
  (position) => {
    const entries = Array.from({ length: 100 }, (_, index) => ({
      ...results.entries[0],
      user_id: index === position ? actor : `synthetic-${index}`,
      display_name: `Participant ${index}`,
      rank: index + 1,
      total_score: 1000 - index,
    }));
    const input = {
      accountKey: 'config:' + actor,
      actor,
      challenges: [challenge],
      listUpdatedAt: 1000,
      hasMore: false,
      results: new Map([
        [challenge.id, { data: { ...results, entries }, dataUpdatedAt: 900 }],
      ]),
    };
    const legacy = buildCompanionChallenges(input);
    expect(legacy.items[0].rows).toHaveLength(position < 3 ? 3 : 4);
    expect(legacy.items[0]).not.toHaveProperty('rowsAreAdjacent');
    const widget = buildChallengeWidget(
      buildCompanionChallenges({ ...input, rowWindow: 'self' }),
      i18n.t,
      'en'
    );
    expect(widget.generatedAt).toBe(900);
    expect(widget.neighbors.map((row) => row.name)).toEqual(
      entries
        .slice(Math.max(0, position - 1), position + 2)
        .map((row) => row.display_name)
    );
    expect(widget.neighbors.find((row) => row.slot === 'self')?.rank).toBe(
      String(position + 1)
    );
    expect(widget.choices[0].neighbors).toEqual(widget.neighbors);
    expect(JSON.stringify(widget)).not.toContain('daily');
  }
);
it('retains server ties and explicit missing data in the nearby rows', () => {
  const state = snapshot();
  state.items[0].rowsAreAdjacent = true;
  state.items[0].rows = state.items[0].rows.map((row) => ({
    ...row,
    rank: 1,
    tied: true,
    total: 0,
  }));
  state.items[0].rows[1].daysWithSteps = 0;
  const widget = buildChallengeWidget(state, i18n.t, 'en');
  expect(widget.neighbors.map((row) => row.rank)).toEqual(['1', '1']);
  expect(widget.neighbors.map((row) => row.score)).toEqual([
    '0 steps',
    'No step data',
  ]);
});
it('does not invent neighbors from legacy top-three-plus-self projections', () => {
  const widget = buildChallengeWidget(snapshot(), i18n.t, 'en');
  expect(widget.neighbors.map((row) => row.slot)).toEqual(['self']);
});
it('publishes independent choices with account bindings and no invitation results', () => {
  const state = snapshot();
  state.items.push({ ...state.items[0], id: 'second', name: 'Second' });
  state.items.push({
    ...state.items[0],
    id: 'invitation',
    membership: 'pending',
  });
  const widget = buildChallengeWidget(state, i18n.t, 'en');
  expect(widget.choices.map((choice) => choice.id)).toEqual([
    challenge.id,
    'second',
  ]);
  expect(new Set(widget.choices.map((choice) => choice.selectionId)).size).toBe(
    2
  );
  const changedAccount = buildChallengeWidget(
    { ...state, accountKey: 'other-account' },
    i18n.t,
    'en'
  );
  expect(widget.choices[0].selectionId).not.toBe(
    changedAccount.choices[0].selectionId
  );
  expect(JSON.parse(widget.choices[0].selectionId)).toEqual([
    state.accountKey,
    challenge.id,
  ]);
  const cleared = buildChallengeWidget(
    emptyCompanionChallenges(),
    i18n.t,
    'en'
  );
  expect(cleared.choices).toEqual([]);
  expect(cleared.neighbors).toEqual([]);
  expect(cleared.metric).toBe('');
});
it('removal and denied access remove the configuration choice', () => {
  const state = buildCompanionChallenges({
    accountKey: 'config:' + actor,
    actor,
    challenges: [challenge],
    listUpdatedAt: 1000,
    hasMore: false,
    rowWindow: 'self',
    results: new Map([
      [
        challenge.id,
        { data: results, dataUpdatedAt: 1000, inaccessible: true },
      ],
    ]),
  });
  expect(buildChallengeWidget(state, i18n.t, 'en').choices).toEqual([]);
});

it('keeps the same eight-query bound and a compact payload even with long names', () => {
  const challenges = Array.from({ length: 12 }, (_, index) => ({
    ...challenge,
    id: `challenge-${index}`,
    name: '🟢'.repeat(120),
  }));
  const state = buildCompanionChallenges({
    accountKey: 'config:' + actor,
    actor,
    challenges,
    listUpdatedAt: 1000,
    hasMore: false,
    rowWindow: 'self',
    results: new Map(
      challenges.map((item) => [
        item.id,
        {
          data: {
            ...results,
            challenge: item,
            entries: results.entries.map((row) => ({
              ...row,
              display_name: '🟢'.repeat(120),
            })),
          },
          dataUpdatedAt: 1000,
        },
      ])
    ),
  });
  const widget = buildChallengeWidget(state, i18n.t, 'en');
  expect(widget.choices).toHaveLength(8);
  expect(widget.hasMore).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(widget), 'utf8')).toBeLessThan(
    32_768
  );
});
