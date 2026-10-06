import {
  applyPersonalGoalDraft,
  createPersonalGoalDraft,
  type PersonalGoalField,
} from '../../src/utils/personalGoalDraft';
import type { DailyGoals } from '../../src/types/goals';
const goals: DailyGoals = {
  calories: 2200,
  protein: 130,
  carbs: 200,
  fat: 65,
  dietary_fiber: 25,
  steps_goal: null,
  distance_goal_meters: 0,
  active_calories_goal: 350.123456,
  water_goal_ml: 1920,
  target_exercise_duration_minutes: 30,
  custom_nutrients: { example: 42 },
};
const edit = (field: PersonalGoalField, value: string) =>
  applyPersonalGoalDraft(
    goals,
    { ...createPersonalGoalDraft(goals, 'it-IT', {}), [field]: value },
    new Set([field]),
    {}
  );
it('preserves unset, explicit zero, canonical precision and unrelated nutrition', () => {
  const draft = createPersonalGoalDraft(goals, 'it-IT', {});
  expect(draft.steps_goal).toBe('');
  expect(draft.distance_goal_meters).toBe('0');
  expect(draft.active_calories_goal).toBe('350,123456');
  expect(applyPersonalGoalDraft(goals, draft, new Set(), {}).goals).toEqual(
    goals
  );
  expect(edit('distance_goal_meters', '1,5').goals).toEqual({
    ...goals,
    distance_goal_meters: 1500,
  });
});
it.each(['1..5', '1,2,3', '-1', 'Infinity', '1 23', '0'])(
  'rejects invalid positive targets: %s',
  (value) => {
    expect(edit('steps_goal', value)).toEqual({ invalid: 'steps_goal' });
  }
);
it('blank new goals stay unset while existing water goals use their existing zero convention', () => {
  expect(edit('steps_goal', '').goals?.steps_goal).toBeNull();
  expect(edit('water_goal_ml', '').goals?.water_goal_ml).toBe(0);
});
it('converts chosen display units at the boundary, with the app conversion constants', () => {
  const preferences = {
    default_distance_unit: 'miles',
    energy_unit: 'kJ',
    water_display_unit: 'liter',
  } as const;
  const draft = createPersonalGoalDraft(goals, 'it-IT', preferences);
  expect(draft.water_goal_ml).toBe('1,92');
  const next = applyPersonalGoalDraft(
    goals,
    {
      ...draft,
      distance_goal_meters: '2',
      active_calories_goal: '418,4',
      water_goal_ml: '2,5',
    },
    new Set(['distance_goal_meters', 'active_calories_goal', 'water_goal_ml']),
    preferences
  );
  expect(next.goals).toMatchObject({
    distance_goal_meters: 3218.68,
    active_calories_goal: 100,
    water_goal_ml: 2500,
    calories: 2200,
  });
});
it('untouched fields use the latest query values without destroying a draft', () => {
  const draft = createPersonalGoalDraft(goals, 'en', {});
  const next = applyPersonalGoalDraft(
    { ...goals, protein: 145, active_calories_goal: 600 },
    { ...draft, steps_goal: '8000' },
    new Set(['steps_goal']),
    {}
  );
  expect(next.goals).toMatchObject({
    protein: 145,
    active_calories_goal: 600,
    steps_goal: 8000,
  });
});
