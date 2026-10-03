import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
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
import {
  upsertCheckInMeasurements,
  upsertStepData,
} from '../models/measurementRepository.js';
const RUN = process.env.RUN_CHALLENGE_DB_TESTS === '1';
let fixturesAuthorized = false;
const ids = Array.from({ length: 7 }, () => randomUUID());
const [owner, first, second, pending, declined, left, outsider] = ids as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
const today = todayInZone('UTC');
let id: string;
async function system<T>(f: (c: PoolClient) => Promise<T>): Promise<T> {
  const c: PoolClient = await getSystemClient();
  try {
    return await f(c);
  } finally {
    c.release();
  }
}
async function actor<T>(
  user: string,
  f: (c: PoolClient) => Promise<T>,
  target = user
): Promise<T> {
  const c: PoolClient = await getClient(target, user);
  try {
    return await f(c);
  } finally {
    c.release();
  }
}
async function period(start: string, end: string): Promise<void> {
  // Test-only clock fixture, never available to the application role. Change
  // immutable dates as superuser to model passage of time without waiting days.
  await system(async (c) => {
    await c.query('BEGIN');
    try {
      await c.query("SET LOCAL session_replication_role = 'replica'");
      await c.query(
        'UPDATE public.challenges SET start_date=$1,end_date=$2 WHERE id=$3',
        [start, end, id]
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  });
}
async function setSteps(
  user: string,
  day: string,
  value: number | null
): Promise<void> {
  await upsertCheckInMeasurements(user, user, day, { steps: value });
}
describe.runIf(RUN)('Challenge live canonical leaderboard and privacy', () => {
  beforeAll(async () => {
    assertChallengeTestDatabase();
    fixturesAuthorized = true;
    await system(async (c) => {
      for (const user of ids)
        await c.query(
          'INSERT INTO public."user" (id,email,email_verified) VALUES ($1,$2,true)',
          [user, `${user}@example.test`]
        );
      for (const user of ids.slice(1, 6))
        await c.query(
          "INSERT INTO public.family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES ($1,$2,$3,'{}',true,'active')",
          [owner, user, `${user}@example.test`]
        );
    });
  });
  beforeEach(async () => {
    await system(async (c) => {
      await c.query('DELETE FROM public.challenges WHERE creator_user_id=$1', [
        owner,
      ]);
      await c.query(
        'DELETE FROM public.check_in_measurements WHERE user_id=ANY($1::uuid[])',
        [ids]
      );
    });
    const created = await service.create(
      owner,
      createChallengeRequestSchema.parse({
        name: 'Canonical',
        start_date: today,
        end_date: addDays(today, 1),
        timezone: 'UTC',
        participant_ids: ids.slice(1, 6),
      })
    );
    id = created.challenge.id;
    for (const user of [first, second, left])
      await service.respond(user, id, 'accept');
    await service.respond(declined, id, 'decline');
    await service.respond(left, id, 'leave');
    await period(addDays(today, -1), today);
  });
  afterAll(async () => {
    if (!fixturesAuthorized) {
      await endPool();
      return;
    }
    await system((c) =>
      c.query('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [ids])
    );
    await endPool();
  });
  it('reads multiple days for N accepted people; excludes pending, declined and left', async () => {
    await setSteps(owner, addDays(today, -1), 100);
    await setSteps(owner, today, 0);
    await setSteps(first, addDays(today, -1), 50);
    await setSteps(first, today, 60);
    await setSteps(second, addDays(today, -1), 110);
    for (const user of [pending, declined, left])
      await setSteps(user, today, 100000);
    const result = await getChallengeLeaderboard(owner, id);
    expect(challengeLeaderboardResponseSchema.safeParse(result).success).toBe(
      true
    );
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((e) => e.total_score)).toEqual([110, 110, 100]);
    expect(result.entries.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(result.leader_user_ids.sort()).toEqual([first, second].sort());
    expect(
      result.entries.find((e) => e.user_id === owner)?.daily[1]
    ).toMatchObject({ value: 0, present: true });
    expect(
      result.entries.find((e) => e.user_id === second)?.daily[1]
    ).toMatchObject({ value: 0, present: false });
  });
  it('manual canonical decreases, clears, deletes and late arrivals reconcile after end', async () => {
    await period(addDays(today, -2), addDays(today, -1));
    const day = addDays(today, -1);
    await setSteps(owner, day, 1000);
    const score = async () => {
      const r = await getChallengeLeaderboard(first, id);
      expect(r.challenge.lifecycle).toBe('completed');
      return r.entries.find((e) => e.user_id === owner)!;
    };
    expect((await score()).total_score).toBe(1000);
    await setSteps(owner, day, 100);
    expect((await score()).total_score).toBe(100);
    await setSteps(owner, day, null);
    expect((await score()).coverage.days_with_steps).toBe(0);
    await setSteps(owner, day, 50);
    expect((await score()).total_score).toBe(50);
    await actor(owner, (c) =>
      c.query(
        'DELETE FROM public.check_in_measurements WHERE user_id=$1 AND entry_date=$2',
        [owner, day]
      )
    );
    expect((await score()).total_score).toBe(0);
    await setSteps(owner, addDays(today, -2), 500);
    expect((await score()).total_score).toBe(500);
  });
  it('documents upstream ingestion max-wins without adding another max-wins layer', async () => {
    await upsertStepData(owner, owner, 1000, today);
    await upsertStepData(owner, owner, 100, today);
    expect(
      (await getChallengeLeaderboard(owner, id)).entries.find(
        (e) => e.user_id === owner
      )?.total_score
    ).toBe(1000);
    await setSteps(owner, today, 50);
    expect(
      (await getChallengeLeaderboard(owner, id)).entries.find(
        (e) => e.user_id === owner
      )?.total_score
    ).toBe(50);
  });
  it('function denies unconsented, unrelated and switched actors and ordinary health rows remain private', async () => {
    await upsertCheckInMeasurements(owner, owner, today, {
      steps: 100,
      weight: 70,
    });
    for (const user of [pending, declined, left, outsider])
      await actor(user, async (c) => {
        expect(
          (
            await c.query('SELECT * FROM public.challenge_step_points($1)', [
              id,
            ])
          ).rows
        ).toEqual([]);
      });
    await actor(first, async (c) => {
      expect(
        (
          await c.query(
            'SELECT * FROM public.check_in_measurements WHERE user_id=$1',
            [owner]
          )
        ).rows
      ).toEqual([]);
      const projection = await c.query(
        'SELECT * FROM public.challenge_step_points($1)',
        [id]
      );
      expect(projection.fields.map((f) => f.name)).toEqual([
        'user_id',
        'display_name',
        'entry_date',
        'steps',
        'data_updated_at',
      ]);
      expect(projection.rows.find((r) => r.user_id === owner)?.steps).toBe(100);
    });
    await actor(
      first,
      async (c) => {
        expect(
          (
            await c.query('SELECT * FROM public.challenge_step_points($1)', [
              id,
            ])
          ).rows
        ).toEqual([]);
      },
      owner
    );
    await expect(getChallengeLeaderboard(pending, id)).rejects.toMatchObject({
      status: 403,
    });
    for (const user of [declined, left, outsider])
      await expect(getChallengeLeaderboard(user, id)).rejects.toMatchObject({
        status: 404,
      });
  });
  it('never reads dates outside range or future buckets', async () => {
    await setSteps(owner, addDays(today, -2), 10000);
    await setSteps(owner, addDays(today, 1), 10000);
    await setSteps(owner, today, 10);
    expect(
      (await getChallengeLeaderboard(owner, id)).entries.find(
        (e) => e.user_id === owner
      )?.total_score
    ).toBe(10);
    await period(addDays(today, 1), addDays(today, 1));
    const upcoming = await getChallengeLeaderboard(owner, id);
    expect(upcoming.challenge.lifecycle).toBe('upcoming');
    expect(
      upcoming.entries.every((e) => e.total_score === 0 && e.rank === null)
    ).toBe(true);
  });
  it('cancellation immediately stops step projection', async () => {
    await setSteps(owner, today, 100);
    await service.update(owner, id, { cancel: true });
    expect((await getChallengeLeaderboard(first, id)).entries).toEqual([]);
    await actor(first, async (c) => {
      expect(
        (await c.query('SELECT * FROM public.challenge_step_points($1)', [id]))
          .rows
      ).toEqual([]);
    });
  });
  it('leaving immediately removes a participant from every subsequent result', async () => {
    await setSteps(first, today, 10000);
    await service.respond(first, id, 'leave');
    expect(
      (await getChallengeLeaderboard(owner, id)).entries
        .map((e) => e.user_id)
        .sort()
    ).toEqual([owner, second].sort());
    await expect(getChallengeLeaderboard(first, id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
