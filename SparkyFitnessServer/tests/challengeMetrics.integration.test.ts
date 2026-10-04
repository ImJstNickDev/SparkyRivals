import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  createChallengeRequestSchema,
  todayInZone,
  addDays,
  challengeLeaderboardResponseSchema,
  type ChallengeMetric,
} from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import service from '../services/challengeService.js';
import { getChallengeLeaderboard } from '../services/challengeLeaderboardService.js';
import hydration from '../services/hydrationTotalsService.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const users = Array.from({ length: 3 }, () => randomUUID());
const [owner, peer, outsider] = users as [string, string, string];
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
async function challenge(metric: ChallengeMetric) {
  const id = (
    await service.create(
      owner,
      createChallengeRequestSchema.parse({
        name: 'Metric test',
        metric,
        timezone: 'UTC',
        participant_ids: [peer],
        ...(metric === 'hydration'
          ? { scoring_mode: 'goal_progress', duration_days: 2 }
          : { start_date: day, end_date: addDays(day, 1) }),
      })
    )
  ).challenge.id;
  await service.respond(peer, id, 'accept');
  if (metric === 'hydration') {
    for (const actor of [owner, peer])
      await service.configure(actor, id, {
        target_value: 2000,
        expected_revision: 0,
      });
    for (const actor of [owner, peer])
      await service.configure(actor, id, { ready: true, expected_revision: 1 });
  }
  return id;
}
const row = (id: string) =>
  getChallengeLeaderboard(owner, id).then((r) =>
    r.entries.find((e) => e.user_id === owner)!
  );
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'New canonical Challenge metric projections',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      authorized = true;
      for (const id of users)
        await sql(
          'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
          [id, `${id}@example.test`]
        );
      await sql(
        "INSERT INTO family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES($1,$2,$3,'{}',true,'active')",
        [owner, peer, `${peer}@example.test`]
      );
    });
    afterAll(async () => {
      if (authorized)
        await sql('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [
          users,
        ]);
      await endPool();
    });
    it('uses daily distance without a workout, normalizes units and replaces overlapping daily provider totals', async () => {
      const id = await challenge('distance');
      const category = (
        await sql(
          "INSERT INTO custom_categories(user_id,name,measurement_type,frequency,data_type) VALUES($1,'Distance','km','Daily','numeric') RETURNING id",
          [owner]
        )
      ).rows[0].id;
      const first = (
        await sql(
          "INSERT INTO custom_measurements(user_id,category_id,value,entry_date,source,updated_at) VALUES($1,$2,'4.5',$3,'HealthKit',now()-interval '1 minute') RETURNING id",
          [owner, category, day]
        )
      ).rows[0].id;
      expect(await row(id)).toMatchObject({ total_score: 4500 });
      const second = (
        await sql(
          "INSERT INTO custom_measurements(user_id,category_id,value,entry_date,source,updated_at) VALUES($1,$2,'3.25',$3,'Health Connect',now()) RETURNING id",
          [owner, category, day]
        )
      ).rows[0].id;
      expect(await row(id)).toMatchObject({
        total_score: 3250,
        daily: [{ present: true }, { present: false }],
      });
      await sql("UPDATE custom_measurements SET value='0' WHERE id=$1", [
        second,
      ]);
      expect(await row(id)).toMatchObject({
        total_score: 0,
        daily: [{ present: true }, { present: false }],
      });
      await sql('DELETE FROM custom_measurements WHERE id=ANY($1::uuid[])', [
        [first, second],
      ]);
      expect(await row(id)).toMatchObject({
        total_score: 0,
        daily: [{ present: false }, { present: false }],
      });
    });
    it('active calories uses daily synthetic active energy, excludes resting and workout energy', async () => {
      const id = await challenge('active_calories');
      for (const [name, calories] of [
        ['Active Calories', 500],
        ['Resting Calories', 1800],
        ['Private workout', 200],
      ] as const)
        await sql(
          "INSERT INTO exercise_entries(user_id,exercise_name,duration_minutes,calories_burned,entry_date,source) VALUES($1,$2,30,$3,$4,'manual')",
          [owner, name, calories, day]
        );
      expect(await row(id)).toMatchObject({ total_score: 500 });
      expect((await getChallengeLeaderboard(owner, id)).score_unit).toBe(
        'kcal'
      );
      await sql('DELETE FROM exercise_entries WHERE user_id=$1', [owner]);
    });
    it.each(['workout_calories', 'workout_distance'] as const)(
      '%s reuses qualification and counts a group once without exposing another metric',
      async (metric) => {
        const id = await challenge(metric);
        const parent = (
          await sql(
            "INSERT INTO exercise_preset_entries(user_id,name,entry_date,source) VALUES($1,'Private routine',$2,'manual') RETURNING id",
            [owner, day]
          )
        ).rows[0].id;
        for (const [minutes, kcal, km] of [
          [10, 100, 1.25],
          [20, 200, 2.25],
        ])
          await sql(
            "INSERT INTO exercise_entries(user_id,exercise_preset_entry_id,exercise_name,duration_minutes,calories_burned,distance,entry_date,source) VALUES($1,$2,'Private exercise',$3,$4,$5,$6,'manual')",
            [owner, parent, minutes, kcal, km, day]
          );
        await sql(
          "INSERT INTO exercise_entries(user_id,exercise_name,duration_minutes,calories_burned,distance,entry_date,source) VALUES($1,'Active Calories',60,9999,999,$2,'manual'),($1,'Planned',30,500,10,$2,'Workout Plan')",
          [owner, day]
        );
        const result = await getChallengeLeaderboard(owner, id);
        expect(
          challengeLeaderboardResponseSchema.safeParse(result).success
        ).toBe(true);
        expect(await row(id)).toMatchObject({
          total_score: metric === 'workout_calories' ? 300 : 3500,
          total_workout_count: 1,
        });
        const raw = await sql(
          'SELECT * FROM public.challenge_workout_points($1)',
          [id],
          peer
        );
        expect(
          raw.rows.every(
            (r: { workout_seconds: number | null }) =>
              r.workout_seconds === null
          )
        ).toBe(true);
        expect(
          (
            await sql(
              'SELECT * FROM exercise_entries WHERE user_id=$1',
              [owner],
              peer
            )
          ).rows
        ).toEqual([]);
        expect(
          (
            await sql(
              'SELECT * FROM public.challenge_workout_points($1)',
              [id],
              outsider
            )
          ).rows
        ).toEqual([]);
        await sql('DELETE FROM exercise_entries WHERE user_id=$1', [owner]);
        expect(await row(id)).toMatchObject({
          total_score: 0,
          total_workout_count: 0,
        });
      }
    );
    it('hydration equals the existing product total, including food opt-in and excluding linked food twice', async () => {
      const id = await challenge('hydration');
      await sql(
        "INSERT INTO water_intake(user_id,entry_date,water_ml,source) VALUES($1,$2,500,'manual'),($1,$2,250,'HealthKit')",
        [owner, day]
      );
      const food = (
        await sql(
          "INSERT INTO food_entries(user_id,meal_type_id,quantity,unit,entry_date,water_ml,serving_size) VALUES($1,(SELECT id FROM meal_types WHERE user_id IS NULL LIMIT 1),1,'serving',$2,200,1) RETURNING id",
          [owner, day]
        )
      ).rows[0].id;
      const compare = async (expected: number) => {
        expect(
          (await hydration.resolveWaterTotalsForDate(owner, owner, day))
            .water_ml
        ).toBe(expected);
        expect(await row(id)).toMatchObject({
          total_actual_value: expected,
          total_score: (expected / 2000) * 100,
        });
      };
      await compare(750);
      await sql(
        'INSERT INTO user_preferences(user_id,add_food_water_to_intake) VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET add_food_water_to_intake=true',
        [owner]
      );
      await compare(950);
      // The product ledger writer materializes its entry in the daily total. Once
      // linked, the food portion is excluded instead of being added a second time.
      await sql(
        'INSERT INTO water_intake_entries(user_id,entry_date,water_ml,food_entry_id) VALUES($1,$2,200,$3)',
        [owner, day, food]
      );
      await sql(
        "UPDATE water_intake SET water_ml=700 WHERE user_id=$1 AND entry_date=$2 AND source='manual'",
        [owner, day]
      );
      await compare(950);
      expect(
        (
          await sql(
            'SELECT * FROM canonical_hydration_days($1::uuid[],$2,$2)',
            [[owner], day],
            peer
          )
        ).rows
      ).toEqual([]);
      expect(
        (
          await sql(
            'SELECT * FROM challenge_daily_metric_points($1)',
            [id],
            outsider
          )
        ).rows
      ).toEqual([]);
    });
  }
);
