import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, todayInZone } from '@workspace/shared';
import { endPool, getClient, getSystemClient } from '../db/poolManager.js';

const RUN = process.env.RUN_CHALLENGE_DB_TESTS === '1';
const owner = randomUUID();
const invitee = randomUUID();
const outsider = randomUUID();
const ids = [owner, invitee, outsider];
let challengeId: string;

async function asActor<T>(
  actor: string,
  action: (client: PoolClient) => Promise<T>,
  target = actor
): Promise<T> {
  const client: PoolClient = await getClient(target, actor);
  try {
    return await action(client);
  } finally {
    client.release();
  }
}

describe.runIf(RUN)('Challenge database constraints and RLS', () => {
  beforeAll(async () => {
    if (!/(^|[_-])test([_-]|$)/i.test(process.env.SPARKY_FITNESS_DB_NAME ?? ''))
      throw new Error('Requires a disposable test database');
    const sys: PoolClient = await getSystemClient();
    try {
      for (const id of ids)
        await sys.query(
          'INSERT INTO public."user" (id, email, email_verified) VALUES ($1, $2, true)',
          [id, `${id}@example.test`]
        );
      await sys.query(
        "INSERT INTO public.family_access (owner_user_id, family_user_id, family_email, access_permissions, is_active, status) VALUES ($1, $2, $3, '{}', true, 'active')",
        [owner, invitee, `${invitee}@example.test`]
      );
    } finally {
      sys.release();
    }
  });
  afterAll(async () => {
    if (!RUN) return;
    const sys: PoolClient = await getSystemClient();
    try {
      await sys.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [
        ids,
      ]);
    } finally {
      sys.release();
      await endPool();
    }
  });
  it('creates the challenge and automatically accepts the creator', async () => {
    const today = todayInZone('UTC');
    await asActor(owner, async (c) => {
      const result = await c.query<{ id: string }>(
        "INSERT INTO public.challenges (creator_user_id, name, start_date, end_date, timezone) VALUES ($1, 'Steps', $2, $3, 'UTC') RETURNING id",
        [owner, addDays(today, 1), addDays(today, 7)]
      );
      challengeId = result.rows[0]!.id;
      const members = await c.query(
        'SELECT user_id, status FROM public.challenge_participants WHERE challenge_id = $1',
        [challengeId]
      );
      expect(members.rows).toEqual([{ user_id: owner, status: 'accepted' }]);
    });
  });
  it('rejects impersonated creation and a switched actor', async () => {
    const today = todayInZone('UTC');
    for (const target of [owner, outsider]) {
      await expect(
        asActor(
          outsider,
          (c) =>
            c.query(
              "INSERT INTO public.challenges (creator_user_id, name, start_date, end_date, timezone) VALUES ($1, 'Forged', $2, $2, 'UTC')",
              [owner, today]
            ),
          target
        )
      ).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('rejects invalid dates, duration, timezone, metric and names at the database', async () => {
    const today = todayInZone('UTC');
    const base = ['Steps', today, addDays(today, 6), 'UTC', 'steps', 'sum'];
    for (const [index, value] of [
      [0, ''],
      [0, 'x'.repeat(101)],
      [2, addDays(today, -1)],
      [2, addDays(today, 366)],
      [3, 'Not/AZone'],
      [4, 'energy'],
      [5, 'max'],
    ] as const) {
      const values = [...base];
      values[index] = value;
      await expect(
        asActor(owner, (c) =>
          c.query(
            'INSERT INTO public.challenges (creator_user_id, name, start_date, end_date, timezone, metric, scoring_mode) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [owner, ...values]
          )
        )
      ).rejects.toMatchObject({ code: '23514' });
    }
  });
  it('hides challenges and other participant rows from outsiders and switched delegates', async () => {
    for (const [actor, target] of [
      [outsider, outsider],
      [invitee, owner],
    ]) {
      await asActor(
        actor!,
        async (c) => {
          expect(
            (
              await c.query('SELECT * FROM public.challenges WHERE id = $1', [
                challengeId,
              ])
            ).rows
          ).toEqual([]);
          expect(
            (
              await c.query(
                'SELECT * FROM public.challenge_participants WHERE challenge_id = $1',
                [challengeId]
              )
            ).rows
          ).toEqual([]);
        },
        target
      );
    }
  });
  it('only the creator can invite an existing active relationship as pending', async () => {
    const invite = (actor: string, user: string, status = 'pending') =>
      asActor(actor, (c) =>
        c.query(
          'INSERT INTO public.challenge_participants (challenge_id,user_id,invited_by_user_id,status) VALUES ($1,$2,$3,$4)',
          [challengeId, user, actor, status]
        )
      );
    await expect(invite(owner, outsider)).rejects.toMatchObject({
      code: '42501',
    });
    await expect(invite(owner, invitee, 'accepted')).rejects.toMatchObject({
      code: '42501',
    });
    await expect(invite(outsider, outsider)).rejects.toMatchObject({
      code: '42501',
    });
    await invite(owner, invitee);
    await expect(invite(owner, invitee)).rejects.toMatchObject({
      code: '23505',
    });
  });
  it('pending invitee reads rules and own invitation only', async () => {
    await asActor(invitee, async (c) => {
      expect(
        (
          await c.query('SELECT id FROM public.challenges WHERE id=$1', [
            challengeId,
          ])
        ).rowCount
      ).toBe(1);
      expect(
        (
          await c.query(
            'SELECT user_id FROM public.challenge_participants WHERE challenge_id=$1',
            [challengeId]
          )
        ).rows
      ).toEqual([{ user_id: invitee }]);
    });
  });
  it('creator cannot accept for someone else or mutate their identity', async () => {
    await asActor(owner, async (c) => {
      expect(
        (
          await c.query(
            "UPDATE public.challenge_participants SET status='accepted' WHERE challenge_id=$1 AND user_id=$2",
            [challengeId, invitee]
          )
        ).rowCount
      ).toBe(0);
    });
    await expect(
      asActor(invitee, (c) =>
        c.query(
          'UPDATE public.challenge_participants SET user_id=$1 WHERE challenge_id=$2 AND user_id=$3',
          [outsider, challengeId, invitee]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('invitee accepts and can see accepted roster, without check-in access', async () => {
    await asActor(invitee, async (c) => {
      await c.query(
        "UPDATE public.challenge_participants SET status='accepted' WHERE challenge_id=$1 AND user_id=$2",
        [challengeId, invitee]
      );
      expect(
        (
          await c.query(
            'SELECT user_id FROM public.challenge_participants WHERE challenge_id=$1',
            [challengeId]
          )
        ).rowCount
      ).toBe(2);
      expect(
        (
          await c.query(
            'SELECT * FROM public.check_in_measurements WHERE user_id=$1',
            [owner]
          )
        ).rows
      ).toEqual([]);
      expect(
        (
          await c.query(
            'UPDATE public.challenges SET cancelled_at=now() WHERE id=$1',
            [challengeId]
          )
        ).rowCount
      ).toBe(0);
    });
  });
  it('rules cannot be edited after invitations have been accepted', async () => {
    await expect(
      asActor(owner, (c) =>
        c.query(
          "UPDATE public.challenges SET timezone='Europe/Rome' WHERE id=$1",
          [challengeId]
        )
      )
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      asActor(owner, (c) =>
        c.query(
          "UPDATE public.challenge_participants SET status='left' WHERE challenge_id=$1 AND user_id=$2",
          [challengeId, owner]
        )
      )
    ).rejects.toMatchObject({ code: '42501' });
  });
  it('leaving revokes access; cannot reaccept or erase membership', async () => {
    await asActor(invitee, async (c) => {
      await c.query(
        "UPDATE public.challenge_participants SET status='left' WHERE challenge_id=$1 AND user_id=$2",
        [challengeId, invitee]
      );
      expect(
        (
          await c.query('SELECT * FROM public.challenges WHERE id=$1', [
            challengeId,
          ])
        ).rows
      ).toEqual([]);
      expect(
        (
          await c.query(
            'DELETE FROM public.challenge_participants WHERE challenge_id=$1',
            [challengeId]
          )
        ).rowCount
      ).toBe(0);
      await expect(
        c.query(
          "UPDATE public.challenge_participants SET status='accepted' WHERE challenge_id=$1 AND user_id=$2",
          [challengeId, invitee]
        )
      ).rejects.toMatchObject({ code: '23514' });
    });
  });
  it('owner can cancel once, cannot erase or reopen a challenge', async () => {
    await asActor(owner, async (c) => {
      await c.query(
        'UPDATE public.challenges SET cancelled_at=now() WHERE id=$1',
        [challengeId]
      );
      await expect(
        c.query('UPDATE public.challenges SET cancelled_at=NULL WHERE id=$1', [
          challengeId,
        ])
      ).rejects.toMatchObject({ code: '23514' });
      expect(
        (
          await c.query('DELETE FROM public.challenges WHERE id=$1', [
            challengeId,
          ])
        ).rowCount
      ).toBe(0);
    });
  });
});
