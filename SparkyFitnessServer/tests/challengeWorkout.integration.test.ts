import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeLeaderboardResponseSchema,
} from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import service from '../services/challengeService.js';
import { getChallengeLeaderboard } from '../services/challengeLeaderboardService.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const ids = Array.from({ length: 5 }, () => randomUUID());
const [owner, peer, third, pending, outsider] = ids as [
  string,
  string,
  string,
  string,
  string,
];
const today = todayInZone('UTC');
let challengeId: string;
let authorized = false;
async function sql(query: string, values: unknown[] = []) {
  const c = await getSystemClient();
  try {
    return await c.query(query, values);
  } finally {
    c.release();
  }
}
async function entry(
  options: {
    user?: string;
    duration?: number | string;
    source?: string;
    sourceId?: string;
    parent?: string;
    name?: string;
    sets?: Array<boolean>;
    date?: string;
  } = {}
) {
  const id = randomUUID();
  await sql(
    `INSERT INTO exercise_entries(id,user_id,exercise_name,duration_minutes,calories_burned,entry_date,source,source_id,exercise_preset_entry_id)
    VALUES($1,$2,$3,$4,99999,$5,$6,$7,$8)`,
    [
      id,
      options.user ?? owner,
      options.name ?? 'Private workout',
      options.duration ?? 30,
      options.date ?? today,
      options.source ?? 'manual',
      options.sourceId ?? null,
      options.parent ?? null,
    ]
  );
  for (const [index, done] of (options.sets ?? []).entries())
    await sql(
      'INSERT INTO exercise_entry_sets(exercise_entry_id,set_number,completed_at) VALUES($1,$2,$3)',
      [id, index + 1, done ? new Date(Date.now() - 1000) : null]
    );
  return id;
}
async function parent(source = 'manual') {
  const id = randomUUID();
  await sql(
    'INSERT INTO exercise_preset_entries(id,user_id,name,entry_date,source) VALUES($1,$2,$3,$4,$5)',
    [id, owner, 'Private routine', today, source]
  );
  return id;
}
async function result() {
  return getChallengeLeaderboard(owner, challengeId);
}
async function own() {
  return (await result()).entries.find((e) => e.user_id === owner)!;
}
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'Workout Challenge canonical projection',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      authorized = true;
      for (const id of ids)
        await sql(
          'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
          [id, `${id}@example.test`]
        );
      for (const id of [peer, third, pending])
        await sql(
          "INSERT INTO family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES($1,$2,$3,'{}',true,'active')",
          [owner, id, `${id}@example.test`]
        );
    });
    beforeEach(async () => {
      await sql('DELETE FROM challenges WHERE creator_user_id=$1', [owner]);
      await sql('DELETE FROM exercise_entries WHERE user_id=ANY($1::uuid[])', [
        ids,
      ]);
      await sql(
        'DELETE FROM exercise_preset_entries WHERE user_id=ANY($1::uuid[])',
        [ids]
      );
      challengeId = (
        await service.create(
          owner,
          createChallengeRequestSchema.parse({
            name: 'Workout time',
            metric: 'workout_time',
            start_date: today,
            end_date: addDays(today, 1),
            timezone: 'UTC',
            participant_ids: [peer, third, pending],
          })
        )
      ).challenge.id;
      await service.respond(peer, challengeId, 'accept');
      await service.respond(third, challengeId, 'accept');
    });
    afterAll(async () => {
      if (authorized)
        await sql('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [ids]);
      await endPool();
    });
    it('counts multi-exercise grouped sessions once and uses history child duration sum', async () => {
      const p = await parent();
      await entry({ parent: p, duration: 10, sets: [true, true] });
      await entry({ parent: p, duration: 20, sets: [true] });
      const p2 = await parent();
      await entry({ parent: p2, duration: 15, sets: [true] });
      expect(await own()).toMatchObject({
        total_score: 2700,
        total_workout_count: 2,
        coverage: { days_with_data: 1 },
        daily: [
          { value: 2700, workout_count: 2, present: true },
          { value: 0, workout_count: 0, present: false, eligible: false },
        ],
      });
      const r = await result();
      expect(r.score_unit).toBe('seconds');
      expect(r.contract_version).toBe(2);
      expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(
        true
      );
    });
    it.each([
      'HealthKit',
      'Health Connect',
      'garmin',
      'garmin_fit',
      'coros_mcp',
    ])(
      'counts normalized completed %s activity without telemetry precedence',
      async (source) => {
        const id = await entry({
          source,
          sourceId: 'provider-record',
          duration: 1.25,
        });
        await sql(
          'UPDATE exercise_entries SET watch_duration_minutes=99,elapsed_time_seconds=999,moving_time_seconds=500 WHERE id=$1',
          [id]
        );
        expect(await own()).toMatchObject({
          total_score: 75,
          total_workout_count: 1,
        });
      }
    );
    it.each(['Hevy', 'Liftosaur'])(
      'counts imported %s parent once despite children and unmarked sets',
      async (source) => {
        const p = await parent(source);
        await entry({
          parent: p,
          source,
          sourceId: 'workout_1',
          duration: 45,
          sets: [false],
        });
        await entry({
          parent: p,
          source,
          sourceId: 'workout_2',
          duration: 0,
          sets: [false],
        });
        expect(await own()).toMatchObject({
          total_score: 2700,
          total_workout_count: 1,
        });
      }
    );
    it('excludes Active Calories even with positive duration, completion or deleted library definition', async () => {
      await entry({ name: 'Active Calories', duration: 100, sets: [true] });
      expect(await own()).toMatchObject({
        total_score: 0,
        total_workout_count: 0,
        coverage: { days_with_data: 0 },
      });
    });
    it('excludes planned preset fallback durations and incomplete local set scaffolds', async () => {
      const p = await parent('Workout Plan');
      await entry({ parent: p, duration: 30, sets: [false] });
      await entry({ duration: 30, sets: [true, false] });
      await entry({ source: 'Workout Preset', duration: 30 });
      expect(await own()).toMatchObject({
        total_score: 0,
        total_workout_count: 0,
      });
    });
    it('scheduled assignment duration requires completed sets, even with a manual source', async () => {
      const exercise = randomUUID();
      await sql(
        "INSERT INTO exercises(id,user_id,name,category,source) VALUES($1,$2,'Scheduled private activity','Cardio','manual')",
        [exercise, owner]
      );
      const template = (
        await sql(
          "INSERT INTO workout_plan_templates(user_id,plan_name) VALUES($1,'Private plan') RETURNING id",
          [owner]
        )
      ).rows[0].id;
      const assignment = (
        await sql(
          'INSERT INTO workout_plan_template_assignments(template_id,day_of_week,exercise_id) VALUES($1,0,$2) RETURNING id',
          [template, exercise]
        )
      ).rows[0].id;
      const id = await entry({ duration: 30 });
      await sql(
        'UPDATE exercise_entries SET workout_plan_assignment_id=$1 WHERE id=$2',
        [assignment, id]
      );
      expect((await own()).total_score).toBe(0);
      await sql(
        'INSERT INTO exercise_entry_sets(exercise_entry_id,set_number,completed_at) VALUES($1,1,NOW())',
        [id]
      );
      expect((await own()).total_score).toBe(1800);
    });
    it('Steps membership cannot project workout data and delegated actors cannot borrow consent', async () => {
      await entry({ duration: 20 });
      const steps = await service.create(
        owner,
        createChallengeRequestSchema.parse({
          name: 'Steps only',
          start_date: today,
          end_date: today,
          timezone: 'UTC',
          participant_ids: [peer],
        })
      );
      await service.respond(peer, steps.challenge.id, 'accept');
      for (const [target, actor, id] of [
        [peer, peer, steps.challenge.id],
        [owner, outsider, challengeId],
      ]) {
        const c = await getClient(target!, actor!);
        try {
          expect(
            (await c.query('SELECT * FROM challenge_workout_points($1)', [id]))
              .rows
          ).toEqual([]);
        } finally {
          c.release();
        }
      }
    });
    it('never credits a partially complete grouped workout from just one completed child', async () => {
      const p = await parent();
      await entry({ parent: p, sets: [true] });
      await entry({ parent: p, sets: [false] });
      expect((await own()).total_workout_count).toBe(0);
    });
    it('counts manually logged duration without set scaffolding and rounds once per day', async () => {
      await entry({ duration: 0.004 });
      await entry({ duration: 0.004 });
      await entry({ duration: 0.004 });
      expect(await own()).toMatchObject({
        total_score: 1,
        total_workout_count: 3,
      });
    });
    it('distinguishes absent, ambiguous zero, and qualifying completed zero', async () => {
      await entry({ duration: 0 });
      expect((await own()).daily[0]?.present).toBe(false);
      await entry({ duration: 0, sets: [true] });
      expect((await own()).daily[0]).toMatchObject({
        value: 0,
        present: true,
        workout_count: 1,
      });
    });
    it.each([-1, 'NaN', 'Infinity', 10081])(
      'skips corrupt/out-of-bound duration %s',
      async (duration) => {
        await entry({ duration, sets: [true] });
        expect((await own()).total_workout_count).toBe(0);
      }
    );
    it('ranks N participants by time alone, never workout count or calories', async () => {
      await entry({ duration: 10 });
      await entry({ duration: 10 });
      await entry({ user: peer, duration: 20 });
      await entry({ user: third, duration: 15 });
      await entry({ user: pending, duration: 999 });
      const r = await result();
      expect(r.entries.map((e) => e.total_score)).toEqual([1200, 1200, 900]);
      expect(r.entries.map((e) => e.rank)).toEqual([1, 1, 3]);
      expect(r.lead_margin).toBe(0);
      expect(r.entries[2]?.gap_to_leader).toBe(300);
    });
    it('reconciles edits, deletes and late arrivals after completion', async () => {
      await sql('ALTER TABLE challenges DISABLE TRIGGER challenge_write_guard');
      try {
        await sql(
          'UPDATE challenges SET start_date=$1,end_date=$1 WHERE id=$2',
          [addDays(today, -1), challengeId]
        );
      } finally {
        await sql(
          'ALTER TABLE challenges ENABLE TRIGGER challenge_write_guard'
        );
      }
      const id = await entry({ date: addDays(today, -1), duration: 60 });
      expect((await result()).challenge.lifecycle).toBe('completed');
      expect((await own()).total_score).toBe(3600);
      await sql('UPDATE exercise_entries SET duration_minutes=10 WHERE id=$1', [
        id,
      ]);
      expect((await own()).total_score).toBe(600);
      await sql('DELETE FROM exercise_entries WHERE id=$1', [id]);
      expect((await own()).total_score).toBe(0);
      await entry({ date: addDays(today, -1), duration: 20 });
      expect((await own()).total_score).toBe(1200);
    });
    it('limits dates, consent, and the database projection without granting diary access', async () => {
      await entry({ date: addDays(today, -1), duration: 100 });
      await entry({ date: addDays(today, 1), duration: 100 });
      await entry({ duration: 10 });
      expect((await own()).total_score).toBe(600);
      for (const actor of [pending, outsider]) {
        const c = await getClient(actor, actor);
        try {
          expect(
            (
              await c.query('SELECT * FROM challenge_workout_points($1)', [
                challengeId,
              ])
            ).rows
          ).toEqual([]);
        } finally {
          c.release();
        }
      }
      const c = await getClient(peer, peer);
      try {
        expect(
          (
            await c.query('SELECT * FROM exercise_entries WHERE user_id=$1', [
              owner,
            ])
          ).rows
        ).toEqual([]);
        expect(
          (
            await c.query('SELECT * FROM challenge_step_points($1)', [
              challengeId,
            ])
          ).rows
        ).toEqual([]);
        const projected = await c.query(
          'SELECT * FROM challenge_workout_points($1)',
          [challengeId]
        );
        expect(projected.fields.map((f: { name: string }) => f.name)).toEqual([
          'user_id',
          'display_name',
          'entry_date',
          'workout_seconds',
          'workout_count',
          'data_updated_at',
        ]);
      } finally {
        c.release();
      }
      await service.respond(peer, challengeId, 'leave');
      expect((await result()).entries).toHaveLength(2);
      await service.update(owner, challengeId, { cancel: true });
      expect((await result()).entries).toEqual([]);
    });
  }
);
