import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  todayInZone,
  suggestedChallengeTarget,
  type ChallengePersonalGoals,
} from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import goalService from '../services/goalService.js';
import presetRepository from '../models/goalPresetRepository.js';
import { DEFAULT_GOALS } from '../constants/goals.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const owner = randomUUID(),
  other = randomUUID();
const day = todayInZone('UTC');
let authorized = false;
async function sql(text: string, values: unknown[] = [], actor?: string) {
  const c = actor ? await getClient(actor, actor) : await getSystemClient();
  try {
    return await c.query(text, values);
  } finally {
    c.release();
  }
}
async function save(date: string, extra: Record<string, unknown> = {}) {
  await goalService.manageGoalTimeline(owner, {
    ...Object.fromEntries(
      Object.entries(DEFAULT_GOALS).map(([key, value]) => [`p_${key}`, value])
    ),
    p_start_date: date,
    p_cascade: false,
    ...extra,
  });
}
const read = async (date = day) =>
  (await goalService.getUserGoals(owner, date)) as ChallengePersonalGoals & {
    calories: number | string;
  };
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'Personal activity goal timeline and privacy',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      authorized = true;
      for (const id of [owner, other])
        await sql(
          'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
          [id, `${id}@example.test`]
        );
    });
    afterAll(async () => {
      if (authorized)
        await sql('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [
          [owner, other],
        ]);
      await endPool();
    });
    it('persists the three activity goals on the ordinary dated timeline', async () => {
      await save(day, {
        p_steps_goal: 8000,
        p_distance_goal_meters: 5500,
        p_active_calories_goal: 350,
        p_target_exercise_duration_minutes: 42,
        p_target_exercise_calories_burned: 250,
        p_water_goal_ml: 2000,
      });
      const goals = await read();
      expect(suggestedChallengeTarget('steps', goals)).toBe(8000);
      expect(suggestedChallengeTarget('distance', goals)).toBe(5500);
      expect(suggestedChallengeTarget('active_calories', goals)).toBe(350);
      expect(suggestedChallengeTarget('workout_time', goals)).toBe(2520);
      expect(suggestedChallengeTarget('workout_calories', goals)).toBe(250);
      expect(suggestedChallengeTarget('hydration', goals)).toBe(2000);
      expect(Number(goals.calories)).toBe(2000);
    });
    it('an older nutrition client omitting activity fields preserves them', async () => {
      await save(day, { p_calories: 2100 });
      expect(suggestedChallengeTarget('active_calories', await read())).toBe(
        350
      );
      expect(suggestedChallengeTarget('steps', await read())).toBe(8000);
      expect(Number((await read()).calories)).toBe(2100);
    });
    it('a future goal does not change previous days and null deliberately removes the suggestion', async () => {
      await save(addDays(day, 2), {
        p_steps_goal: 9000,
        p_distance_goal_meters: null,
        p_active_calories_goal: 400,
      });
      expect(suggestedChallengeTarget('steps', await read(day))).toBe(8000);
      expect(
        suggestedChallengeTarget('steps', await read(addDays(day, 3)))
      ).toBe(9000);
      expect(
        suggestedChallengeTarget('distance', await read(addDays(day, 3)))
      ).toBeNull();
    });
    it('rejects invalid technical targets without selecting fairness minima', async () => {
      for (const value of [-1, 0, Infinity, 1000000001])
        await expect(save(day, { p_steps_goal: value })).rejects.toThrow();
      await save(day, { p_steps_goal: 0.000001 });
      expect(suggestedChallengeTarget('steps', await read())).toBe(0.000001);
    });
    it('presets and weekly plans retain activity goals alongside nutrition and water', async () => {
      const preset = await presetRepository.createGoalPreset({
        user_id: owner,
        preset_name: 'Activity plan',
        ...DEFAULT_GOALS,
        water_goal: 2400,
        steps_goal: 10000,
        distance_goal_meters: 7000,
        active_calories_goal: 450,
      });
      const start = addDays(day, 5);
      await sql(
        "INSERT INTO weekly_goal_plans(user_id,plan_name,start_date,is_active,monday_preset_id,tuesday_preset_id,wednesday_preset_id,thursday_preset_id,friday_preset_id,saturday_preset_id,sunday_preset_id) VALUES($1,'Weekly',$2,true,$3,$3,$3,$3,$3,$3,$3)",
        [owner, start, preset.id]
      );
      const goals = await read(start);
      expect(suggestedChallengeTarget('steps', goals)).toBe(10000);
      expect(suggestedChallengeTarget('active_calories', goals)).toBe(450);
      expect(suggestedChallengeTarget('hydration', goals)).toBe(2400);
    });
    it('does not grant ordinary users other accounts personal-goal reads or updates', async () => {
      expect(
        (await sql('SELECT * FROM user_goals WHERE user_id=$1', [owner], other))
          .rows
      ).toEqual([]);
      expect(
        (
          await sql(
            'UPDATE user_goals SET steps_goal=1 WHERE user_id=$1',
            [owner],
            other
          )
        ).rowCount
      ).toBe(0);
    });
  }
);
