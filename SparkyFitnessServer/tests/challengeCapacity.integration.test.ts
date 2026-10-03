import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChallengeRequestSchema, todayInZone } from '@workspace/shared';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import service from '../services/challengeService.js';
import { getChallengeLeaderboard } from '../services/challengeLeaderboardService.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const RUN = process.env.RUN_CHALLENGE_DB_TESTS === '1';
const ids = Array.from({ length: 101 }, () => randomUUID());
const owner = ids[0]!;
let fixturesAuthorized = false;
let id: string;
describe.runIf(RUN)(
  'Challenge capacity, contention and relationship eligibility',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      fixturesAuthorized = true;
      const c: PoolClient = await getSystemClient();
      try {
        await c.query(
          'INSERT INTO public."user" (id,email,email_verified) SELECT u,u::text || \'@example.test\',true FROM unnest($1::uuid[]) u',
          [ids]
        );
        await c.query(
          "INSERT INTO public.family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) SELECT $1,u,u::text || '@example.test','{}',true,'active' FROM unnest($2::uuid[]) u",
          [owner, ids.slice(1)]
        );
      } finally {
        c.release();
      }
    });
    afterAll(async () => {
      if (!fixturesAuthorized) {
        await endPool();
        return;
      }
      const c: PoolClient = await getSystemClient();
      try {
        await c.query('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [
          ids,
        ]);
      } finally {
        c.release();
        await endPool();
      }
    });
    it('serializes two invitations competing for the final slot', async () => {
      const today = todayInZone('UTC');
      const created = await service.create(
        owner,
        createChallengeRequestSchema.parse({
          name: 'Capacity',
          start_date: today,
          end_date: today,
          timezone: 'UTC',
          participant_ids: ids.slice(1, 99),
        })
      );
      id = created.challenge.id;
      expect(created.participants).toHaveLength(99);
      const attempts = await Promise.allSettled(
        ids.slice(99).map((target) => service.invite(owner, id, target))
      );
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = attempts.find((r) => r.status === 'rejected');
      expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({
        status: 409,
      });
      expect((await service.detail(owner, id)).participants).toHaveLength(100);
    });
    it('returns one bounded result for 100 consenting participants', async () => {
      const roster = (await service.detail(owner, id)).participants;
      for (const p of roster)
        if (p.user_id !== owner) await service.respond(p.user_id, id, 'accept');
      const result = await getChallengeLeaderboard(owner, id);
      expect(result.entries).toHaveLength(100);
      expect(
        result.entries.every(
          (e) =>
            e.rank === 1 &&
            e.is_tied &&
            e.total_score === 0 &&
            e.daily.length === 1
        )
      ).toBe(true);
      const c: PoolClient = await getClient(owner, owner);
      try {
        const indexes = await c.query<{ indexdef: string }>(
          "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='check_in_measurements'"
        );
        expect(
          indexes.rows.some((row) =>
            /UNIQUE.*\(user_id, entry_date\)/.test(row.indexdef)
          )
        ).toBe(true);
      } finally {
        c.release();
      }
    });
    it.each(['inactive', 'pending', 'expired', 'future'])(
      'rejects %s relationships before consent',
      async (kind) => {
        const target = ids[1]!;
        const c: PoolClient = await getSystemClient();
        try {
          await c.query(
            'UPDATE public.family_access SET is_active=$1, status=$2, access_end_date=$3, access_start_date=$4 WHERE owner_user_id=$5 AND family_user_id=$6',
            [
              kind !== 'inactive',
              kind === 'pending' ? 'pending' : 'active',
              kind === 'expired' ? new Date(0) : null,
              kind === 'future' ? new Date('2099-01-01') : new Date(0),
              owner,
              target,
            ]
          );
          const day = todayInZone('UTC');
          await expect(
            service.create(
              owner,
              createChallengeRequestSchema.parse({
                name: 'Ineligible',
                start_date: day,
                end_date: day,
                timezone: 'UTC',
                participant_ids: [target],
              })
            )
          ).rejects.toMatchObject({ status: 403 });
        } finally {
          await c.query(
            "UPDATE public.family_access SET is_active=true,status='active',access_start_date=now(),access_end_date=NULL WHERE owner_user_id=$1 AND family_user_id=$2",
            [owner, target]
          );
          c.release();
        }
      }
    );
    it('relationship removal prevents new invites but does not impersonate prior consent', async () => {
      const c: PoolClient = await getSystemClient();
      try {
        await c.query(
          'DELETE FROM public.family_access WHERE owner_user_id=$1 AND family_user_id=$2',
          [owner, ids[1]]
        );
      } finally {
        c.release();
      }
      expect((await getChallengeLeaderboard(ids[1]!, id)).entries).toHaveLength(
        100
      );
      await service.respond(ids[1]!, id, 'leave');
      expect((await getChallengeLeaderboard(owner, id)).entries).toHaveLength(
        99
      );
    });
  }
);
