import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChallengeRequestSchema, todayInZone } from '@workspace/shared';
import { endPool, getSystemClient } from '../db/poolManager.js';
import service from '../services/challengeService.js';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const [owner, peer, outsider] = [randomUUID(), randomUUID(), randomUUID()];
let invitation = '';
const own: string[] = [];
describe.runIf(process.env.RUN_CHALLENGE_DB_TESTS === '1')(
  'Challenge list collections under RLS',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      const db = await getSystemClient();
      try {
        for (const id of [owner, peer, outsider])
          await db.query(
            'INSERT INTO public."user" (id,email,email_verified) VALUES ($1,$2,true)',
            [id, `${id}@example.test`]
          );
        await db.query(
          "INSERT INTO public.family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES ($1,$2,$3,'{}',true,'active')",
          [owner, peer, `${peer}@example.test`]
        );
      } finally {
        db.release();
      }
      invitation = (
        await service.create(
          peer,
          createChallengeRequestSchema.parse({
            name: 'Older invitation',
            metric: 'steps',
            scoring_mode: 'goal_progress',
            duration_days: 3,
            timezone: 'UTC',
            participant_ids: [owner],
          })
        )
      ).challenge.id;
      for (let i = 0; i < 23; i++)
        own.push(
          (
            await service.create(
              owner,
              createChallengeRequestSchema.parse({
                name: `Preparation ${i}`,
                metric: 'steps',
                scoring_mode: 'goal_progress',
                duration_days: 3,
                timezone: 'UTC',
                participant_ids: [],
              })
            )
          ).challenge.id
        );
      // These fixture accounts are retained in the explicitly disposable database.
      // They are unrelated to manual visual accounts; no retained user data is deleted.
    });
    afterAll(() => endPool());
    it('finds an invitation beyond the first unfiltered page', async () => {
      const plain = await service.list(owner, { limit: 20, offset: 0 });
      expect(plain.has_more).toBe(true);
      expect(plain.challenges.some((c) => c.id === invitation)).toBe(false);
      const filtered = await service.list(owner, {
        limit: 20,
        offset: 0,
        view: 'invitations',
      });
      expect(filtered.challenges.map((c) => c.id)).toEqual([invitation]);
      expect(filtered.has_more).toBe(false);
    });
    it('paginates my collection without duplicates or pending invitations', async () => {
      const first = await service.list(owner, {
        limit: 20,
        offset: 0,
        view: 'mine',
      });
      const last = await service.list(owner, {
        limit: 20,
        offset: 20,
        view: 'mine',
      });
      expect(first.challenges).toHaveLength(20);
      expect(first.has_more).toBe(true);
      expect(last.challenges).toHaveLength(3);
      expect(last.has_more).toBe(false);
      expect(
        new Set([...first.challenges, ...last.challenges].map((c) => c.id)).size
      ).toBe(23);
    });
    it('selects the pending invitation before a newer lobby for the summary', async () => {
      expect(
        (await service.list(owner, { limit: 1, offset: 0, view: 'summary' }))
          .challenges[0]?.id
      ).toBe(invitation);
    });
    it('preserves RLS isolation for every collection', async () => {
      for (const view of ['mine', 'invitations', 'history', 'summary'] as const)
        expect(
          (await service.list(outsider, { limit: 20, offset: 0, view }))
            .challenges
        ).toEqual([]);
    });
    it('moves cancellation into history and excludes it from preparation', async () => {
      await service.update(owner, own[0]!, { cancel: true });
      expect(
        (
          await service.list(owner, { limit: 20, offset: 0, view: 'history' })
        ).challenges.map((c) => c.id)
      ).toEqual([own[0]]);
      expect(
        (
          await service.list(owner, { limit: 50, offset: 0, view: 'mine' })
        ).challenges.some((c) => c.id === own[0])
      ).toBe(false);
    });
    it('keeps legacy contracts limited to fixed-date sum types', async () => {
      const day = todayInZone('UTC');
      const legacy = await service.create(
        owner,
        createChallengeRequestSchema.parse({
          name: 'Legacy',
          metric: 'steps',
          scoring_mode: 'sum',
          start_date: day,
          end_date: day,
          timezone: 'UTC',
          participant_ids: [],
        })
      );
      expect(
        (
          await service.list(owner, { limit: 50, offset: 0 }, false)
        ).challenges.map((c) => c.id)
      ).toEqual([legacy.challenge.id]);
    });
  }
);
