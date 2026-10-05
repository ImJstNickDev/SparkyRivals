import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const [owner, peer, third, outsider] = Array.from({ length: 4 }, () =>
  randomUUID()
) as [string, string, string, string];
const users = [owner, peer, third, outsider];
let authorized = false;
async function sql(text: string, values: unknown[] = [], actor?: string) {
  const client = actor
    ? await getClient(actor, actor)
    : await getSystemClient();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
}
async function lobby(options: Record<string, unknown> = {}) {
  return (
    await service.create(
      owner,
      createChallengeRequestSchema.parse({
        name: 'Goal test',
        metric: 'steps',
        scoring_mode: 'goal_progress',
        duration_days: 3,
        timezone: 'Europe/Rome',
        participant_ids: [peer],
        ...options,
      })
    )
  ).challenge.id;
}
const target = (actor: string, id: string, value = 8000, revision = 0) =>
  service.configure(actor, id, {
    target_value: value,
    expected_revision: revision,
  });
const ready = (actor: string, id: string, value = true, revision = 1) =>
  service.configure(actor, id, { ready: value, expected_revision: revision });
async function twoTargets(id: string) {
  await service.respond(peer, id, 'accept');
  await target(owner, id);
  await target(peer, id);
}
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'Goal lobby transactions and consent',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      authorized = true;
      for (const id of users)
        await sql(
          'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
          [id, `${id}@example.test`]
        );
      for (const id of [peer, third])
        await sql(
          "INSERT INTO family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES($1,$2,$3,'{}',true,'active')",
          [owner, id, `${id}@example.test`]
        );
    });
    afterAll(async () => {
      if (authorized)
        await sql('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [
          users,
        ]);
      await endPool();
    });
    it('starts with null dates, explicit lobby, and creator requiring a target and Ready', async () => {
      const id = await lobby();
      expect((await service.detail(owner, id)).challenge).toMatchObject({
        lifecycle: 'lobby',
        start_date: null,
        end_date: null,
        start_next_day: false,
        duration_days: 3,
      });
      await expect(ready(owner, id, true, 0)).rejects.toThrow();
      const r = await getChallengeLeaderboard(owner, id);
      expect(r.contract_version).toBe(3);
      expect(r.entries.every((e) => e.coverage.eligible_days === 0)).toBe(true);
      expect(
        r.entries.every((e) => e.rank === null && e.daily.length === 0)
      ).toBe(true);
      expect(challengeLeaderboardResponseSchema.safeParse(r).success).toBe(
        true
      );
    });
    it('clears Ready on target edit and rejects obsolete Ready confirmation', async () => {
      const id = await lobby();
      await target(owner, id);
      await ready(owner, id);
      const edited = await target(owner, id, 9000, 1);
      expect(
        edited.participants.find((p) => p.user_id === owner)
      ).toMatchObject({
        target_value: 9000,
        ready_at: null,
        target_revision: 2,
      });
      await expect(ready(owner, id, true, 1)).rejects.toThrow('Target changed');
      await ready(owner, id, true, 2);
      await ready(owner, id, false, 2);
      expect(
        (await service.detail(owner, id)).participants.find(
          (p) => p.user_id === owner
        )?.ready_at
      ).toBeNull();
    });
    it('serializes simultaneous final Ready, locks once, and permits duplicate final Ready', async () => {
      const id = await lobby();
      await twoTargets(id);
      await Promise.all([ready(owner, id), ready(peer, id)]);
      const before = (await service.detail(owner, id)).challenge;
      expect(before).toMatchObject({
        lifecycle: 'active',
        start_date: todayInZone('Europe/Rome'),
        end_date: addDays(todayInZone('Europe/Rome'), 2),
      });
      expect(before.locked_at).toBeTruthy();
      await Promise.all([ready(owner, id), ready(peer, id)]);
      expect((await service.detail(owner, id)).challenge.locked_at).toBe(
        before.locked_at
      );
      await expect(target(peer, id, 12000, 1)).rejects.toThrow('locked');
      await expect(ready(peer, id, false)).rejects.toThrow('locked');
      await expect(service.invite(owner, id, third)).rejects.toThrow('closed');
    });
    it('locks targets now but schedules next Challenge-local day when selected', async () => {
      const id = await lobby({
        start_next_day: true,
        timezone: 'Pacific/Kiritimati',
        duration_days: 1,
      });
      await twoTargets(id);
      await ready(owner, id);
      await ready(peer, id);
      expect((await service.detail(owner, id)).challenge).toMatchObject({
        lifecycle: 'upcoming',
        start_date: addDays(todayInZone('Pacific/Kiritimati'), 1),
        end_date: addDays(todayInZone('Pacific/Kiritimati'), 1),
      });
      await expect(target(owner, id, 9000, 1)).rejects.toThrow('locked');
    });
    it.each(['withdraw', 'decline'] as const)(
      'pending invitation blocks until %s then automatically activates',
      async (action) => {
        const id = await lobby({ participant_ids: [peer, third] });
        await twoTargets(id);
        await ready(owner, id);
        await ready(peer, id);
        expect((await service.detail(owner, id)).challenge.lifecycle).toBe(
          'lobby'
        );
        if (action === 'withdraw') await service.withdraw(owner, id, third);
        else await service.respond(third, id, 'decline');
        expect((await service.detail(owner, id)).challenge.lifecycle).toBe(
          'active'
        );
      }
    );
    it('cannot withdraw an accepted participant or let an invitee withdraw someone else', async () => {
      const id = await lobby({ participant_ids: [peer, third] });
      await twoTargets(id);
      await expect(service.withdraw(owner, id, peer)).rejects.toThrow(
        'pending'
      );
      await expect(service.withdraw(peer, id, third)).rejects.toThrow(
        'creator'
      );
    });
    it('recalculates after an accepted unready member leaves, still requires two', async () => {
      const id = await lobby({ participant_ids: [peer, third] });
      await twoTargets(id);
      await service.respond(third, id, 'accept');
      await ready(owner, id);
      await ready(peer, id);
      await service.respond(third, id, 'leave');
      expect((await service.detail(owner, id)).challenge.lifecycle).toBe(
        'active'
      );
      const solo = await lobby();
      await target(owner, solo);
      await ready(owner, solo);
      await service.respond(peer, solo, 'decline');
      expect((await service.detail(owner, solo)).challenge.lifecycle).toBe(
        'lobby'
      );
    });
    it('targets are self-only, accepted-visible, pending/outsider results remain private', async () => {
      const id = await lobby({ participant_ids: [peer, third] });
      await twoTargets(id);
      expect(
        (
          await sql(
            'UPDATE challenge_participants SET target_value=1 WHERE challenge_id=$1 AND user_id=$2',
            [id, peer],
            owner
          )
        ).rowCount
      ).toBe(0);
      expect(
        (await service.detail(peer, id)).participants.find(
          (p) => p.user_id === owner
        )?.target_value
      ).toBe(8000);
      expect(
        (await service.detail(third, id)).participants.map((p) => p.user_id)
      ).toEqual([third]);
      await expect(getChallengeLeaderboard(third, id)).rejects.toThrow();
      await expect(getChallengeLeaderboard(outsider, id)).rejects.toThrow();
    });
    it('immediate activation includes today in full, uncapped scores reconcile and targets stay fixed', async () => {
      const id = await lobby();
      await twoTargets(id);
      const day = todayInZone('Europe/Rome');
      await sql(
        'INSERT INTO check_in_measurements(user_id,entry_date,steps) VALUES($1,$2,11200) ON CONFLICT(user_id,entry_date) DO UPDATE SET steps=EXCLUDED.steps',
        [owner, day]
      );
      await ready(owner, id);
      await ready(peer, id);
      const row = () =>
        getChallengeLeaderboard(owner, id).then((r) =>
          r.entries.find((e) => e.user_id === owner)!
        );
      expect(await row()).toMatchObject({
        total_score: 140,
        target_value: 8000,
        total_actual_value: 11200,
      });
      await sql(
        'UPDATE check_in_measurements SET steps=16000 WHERE user_id=$1 AND entry_date=$2',
        [owner, day]
      );
      expect(await row()).toMatchObject({
        total_score: 200,
        target_value: 8000,
      });
      await sql(
        'DELETE FROM check_in_measurements WHERE user_id=$1 AND entry_date=$2',
        [owner, day]
      );
      expect(await row()).toMatchObject({
        total_score: 0,
        daily: [{ present: false }, { present: false }, { present: false }],
      });
    });
    it('goal days gives one day for 200%, preserves missing and zero distinction', async () => {
      const id = await lobby({ scoring_mode: 'goal_days' });
      await twoTargets(id);
      await ready(owner, id);
      await ready(peer, id);
      const day = todayInZone('Europe/Rome');
      await sql(
        'INSERT INTO check_in_measurements(user_id,entry_date,steps) VALUES($1,$3,16000),($2,$3,0) ON CONFLICT(user_id,entry_date) DO UPDATE SET steps=EXCLUDED.steps',
        [owner, peer, day]
      );
      const r = await getChallengeLeaderboard(owner, id);
      expect(r.entries.find((e) => e.user_id === owner)).toMatchObject({
        total_score: 1,
        daily: [
          { goal_reached: true, progress_points: 200 },
          { present: false },
          { present: false },
        ],
      });
      expect(r.entries.find((e) => e.user_id === peer)).toMatchObject({
        total_score: 0,
        daily: [
          { goal_reached: false, present: true },
          { present: false },
          { present: false },
        ],
      });
    });
  }
);
