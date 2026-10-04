import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import {
  addDays,
  todayInZone,
  createChallengeRequestSchema,
} from '@workspace/shared';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
import { getClient, getSystemClient, endPool } from '../db/poolManager.js';
import { registerPush } from '../services/pushRegistrationService.js';
import { revokePushInstallation } from '../models/pushRegistrationRepository.js';
import { processRemotePush } from '../services/remotePushService.js';
import {
  PushTransportError,
  type PushTransport,
  type InvitationPushMessage,
} from '../services/expoPushTransport.js';
import challenges from '../models/challengeRepository.js';
import challengeService from '../services/challengeService.js';
const RUN = process.env.RUN_CHALLENGE_DB_TESTS === '1';
const users = [randomUUID(), randomUUID(), randomUUID()];
const [owner, recipient, outsider] = users as [string, string, string];
const secret = randomBytes(32).toString('hex');
const token = () => `ExpoPushToken[${randomBytes(18).toString('hex')}]`;
const registration = () => ({
  installation_id: randomUUID(),
  platform: 'android' as const,
  expo_push_token: token(),
  account_guard: randomUUID(),
  revision: 1,
});
let sys: PoolClient;
async function query(sql: string, params: unknown[] = []) {
  return sys.query(sql, params);
}
async function create() {
  const today = todayInZone('UTC');
  return challenges.create(
    owner,
    createChallengeRequestSchema.parse({
      name: 'Private challenge',
      metric: 'steps',
      start_date: today,
      end_date: addDays(today, 6),
      timezone: 'UTC',
      participant_ids: [recipient],
    })
  );
}
function sender(): PushTransport {
  return {
    send: vi.fn(async (messages: InvitationPushMessage[]) =>
      messages.map(() => ({ status: 'ok' as const, id: randomUUID() }))
    ),
    receipts: vi.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { status: 'ok' as const }]))
    ),
  };
}
async function reset() {
  await query('DELETE FROM public.push_events WHERE user_id=ANY($1::uuid[])', [
    users,
  ]);
  await query(
    'DELETE FROM public.push_installations WHERE user_id=ANY($1::uuid[])',
    [users]
  );
}
describe.runIf(RUN)(
  'Remote push registry, transaction and worker isolation',
  () => {
    beforeAll(async () => {
      assertChallengeTestDatabase();
      vi.stubEnv('SPARKY_FITNESS_REMOTE_PUSH_ENABLED', 'true');
      vi.stubEnv('EXPO_ACCESS_TOKEN', secret);
      sys = await getSystemClient();
      for (const id of users)
        await query(
          'INSERT INTO public."user"(id,email,email_verified) VALUES($1,$2,true)',
          [id, `${id}@example.test`]
        );
      await query(
        "INSERT INTO public.family_access(owner_user_id,family_user_id,family_email,access_permissions,is_active,status) VALUES($1,$2,$3,'{}',true,'active')",
        [owner, recipient, `${recipient}@example.test`]
      );
    });
    afterAll(async () => {
      if (sys) {
        await query('DELETE FROM public."user" WHERE id=ANY($1::uuid[])', [
          users,
        ]);
        sys.release();
      }
      vi.unstubAllEnvs();
      await endPool();
    });
    it('encrypts routing tokens at rest, idempotently renews and safely transfers account ownership', async () => {
      await reset();
      const r = registration();
      const result = await registerPush(recipient, r);
      expect(result.enabled).toBe(true);
      await registerPush(recipient, r);
      const row = (
        await query(
          'SELECT * FROM public.push_installations WHERE installation_id=$1',
          [r.installation_id]
        )
      ).rows[0];
      expect(row.token_ciphertext).not.toContain(r.expo_push_token);
      expect(row.token_hash).toHaveLength(64);
      expect(
        (
          await query(
            'SELECT * FROM public.push_installations WHERE installation_id=$1',
            [r.installation_id]
          )
        ).rowCount
      ).toBe(1);
      await registerPush(outsider, {
        ...r,
        account_guard: randomUUID(),
        revision: 3,
      });
      expect(
        (await registerPush(recipient, { ...r, revision: 2 })).enabled
      ).toBe(false);
      await revokePushInstallation(recipient, {
        installation_id: r.installation_id,
        account_guard: r.account_guard,
        revision: 4,
      });
      expect(
        (
          await query(
            'SELECT user_id,enabled FROM public.push_installations WHERE installation_id=$1',
            [r.installation_id]
          )
        ).rows[0]
      ).toMatchObject({ user_id: outsider, enabled: true });
    });
    it('persists an early revocation so a delayed first registration cannot resurrect it', async () => {
      await reset();
      const r = registration();
      await revokePushInstallation(recipient, {
        installation_id: r.installation_id,
        account_guard: r.account_guard,
        revision: 2,
      });
      expect((await registerPush(recipient, r)).enabled).toBe(false);
      expect(
        (
          await query(
            'SELECT enabled,token_ciphertext,revision FROM public.push_installations'
          )
        ).rows[0]
      ).toMatchObject({
        enabled: false,
        token_ciphertext: null,
        revision: '2',
      });
      expect(
        (await registerPush(recipient, { ...r, revision: 3 })).enabled
      ).toBe(true);
    });
    it('rejects malformed direct RPC arguments without creating a binding', async () => {
      const c: PoolClient = await getClient(recipient, recipient);
      try {
        await expect(
          c.query(
            'SELECT public.register_push_installation($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              randomUUID(),
              'android',
              null,
              'cipher',
              'iv',
              'tag',
              randomUUID(),
              1,
            ]
          )
        ).rejects.toMatchObject({ code: '23514' });
      } finally {
        c.release();
      }
    });
    it('reassigns a token across installations without duplicate active ownership', async () => {
      await reset();
      const r = registration();
      await registerPush(recipient, r);
      await registerPush(outsider, {
        ...registration(),
        expo_push_token: r.expo_push_token,
      });
      expect(
        (await query('SELECT * FROM public.push_installations WHERE enabled'))
          .rowCount
      ).toBe(1);
      expect(
        (
          await query(
            'SELECT token_ciphertext,enabled FROM public.push_installations WHERE installation_id=$1',
            [r.installation_id]
          )
        ).rows[0]
      ).toMatchObject({ token_ciphertext: null, enabled: false });
    });
    it('denies direct token/outbox access and delegated RPCs even under table grants', async () => {
      for (const [actor, target] of [
        [recipient, recipient],
        [outsider, recipient],
      ]) {
        const c: PoolClient = await getClient(target, actor);
        try {
          for (const table of [
            'push_installations',
            'push_events',
            'push_deliveries',
          ])
            expect(
              (await c.query(`SELECT * FROM public.${table}`)).rows
            ).toEqual([]);
          if (actor !== target)
            await expect(
              c.query('SELECT public.revoke_push_installation($1,$2,1)', [
                randomUUID(),
                randomUUID(),
              ])
            ).rejects.toMatchObject({ code: '42501' });
        } finally {
          c.release();
        }
      }
    });
    it('atomically creates exactly one logical event and one delivery per opted-in device; retries do not duplicate', async () => {
      await reset();
      await registerPush(recipient, registration());
      await registerPush(recipient, registration());
      const id = await create();
      expect(
        (
          await query(
            'SELECT * FROM public.push_events WHERE challenge_id=$1',
            [id]
          )
        ).rowCount
      ).toBe(1);
      expect(
        (await query('SELECT * FROM public.push_deliveries')).rowCount
      ).toBe(2);
      await expect(
        challenges.invite(owner, id, recipient)
      ).rejects.toMatchObject({ code: '23505' });
      expect(
        (await query('SELECT * FROM public.push_deliveries')).rowCount
      ).toBe(2);
      const transport = sender();
      await Promise.all([
        processRemotePush(transport),
        processRemotePush(transport),
      ]);
      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(vi.mocked(transport.send).mock.calls[0]![0]).toHaveLength(2);
      await query(
        "UPDATE public.push_deliveries SET next_attempt_at=now()-interval '1 second' WHERE state='ticket'"
      );
      await processRemotePush(transport);
      expect(
        (
          await query(
            "SELECT * FROM public.push_deliveries WHERE state='delivered'"
          )
        ).rowCount
      ).toBe(2);
    });
    it('a push outage leaves the invitation intact and retains bounded retry state', async () => {
      await reset();
      await registerPush(recipient, registration());
      const id = await create();
      const transport = sender();
      vi.mocked(transport.send).mockRejectedValue(
        new PushTransportError('Http503', true)
      );
      await processRemotePush(transport);
      expect(
        (
          await query(
            'SELECT status FROM public.challenge_participants WHERE challenge_id=$1 AND user_id=$2',
            [id, recipient]
          )
        ).rows[0].status
      ).toBe('pending');
      expect(
        (await query('SELECT state,attempts FROM public.push_deliveries'))
          .rows[0]
      ).toMatchObject({ state: 'pending', attempts: 1 });
    });
    it('delivers a new lobby invitation without dates and suppresses a withdrawn invitation', async () => {
      await reset();
      await registerPush(recipient, registration());
      const body = createChallengeRequestSchema.parse({
        name: 'Goal lobby',
        metric: 'steps',
        scoring_mode: 'goal_progress',
        duration_days: 7,
        timezone: 'UTC',
        participant_ids: [recipient],
      });
      const first = await challenges.create(owner, body);
      const transport = sender();
      await processRemotePush(transport);
      expect(transport.send).toHaveBeenCalledTimes(1);
      expect(
        vi.mocked(transport.send).mock.calls[0]![0][0]!.data.challengeId
      ).toBe(first);
      await reset();
      await registerPush(recipient, registration());
      const second = await challenges.create(owner, body);
      await challengeService.withdraw(owner, second, recipient);
      const withdrawn = sender();
      await processRemotePush(withdrawn);
      expect(withdrawn.send).not.toHaveBeenCalled();
      expect(
        (
          await query(
            'SELECT state FROM push_deliveries d JOIN push_events e ON d.event_id=e.id WHERE e.challenge_id=$1',
            [second]
          )
        ).rows
      ).toEqual([{ state: 'suppressed' }]);
    });
    it('suppresses declined, cancelled, disabled and expired recipients before sending', async () => {
      for (const reason of ['declined', 'cancelled', 'disabled', 'expired']) {
        await reset();
        const r = registration();
        await registerPush(recipient, r);
        const id = await create();
        if (reason === 'declined')
          await challenges.respond(recipient, id, 'declined');
        if (reason === 'cancelled')
          await challenges.update(owner, id, { cancel: true });
        if (reason === 'disabled')
          await revokePushInstallation(recipient, {
            installation_id: r.installation_id,
            account_guard: r.account_guard,
            revision: 2,
          });
        if (reason === 'expired')
          await query(
            "UPDATE public.push_installations SET expires_at=now()-interval '1 second'"
          );
        const transport = sender();
        await processRemotePush(transport);
        expect(transport.send).not.toHaveBeenCalled();
        expect(
          (await query('SELECT state FROM public.push_deliveries')).rows[0]
            .state
        ).toBe('suppressed');
      }
    });
    it('does not queue ancient invitations or invitations before opt-in', async () => {
      await reset();
      await create();
      await registerPush(recipient, registration());
      const transport = sender();
      await processRemotePush(transport);
      expect(transport.send).not.toHaveBeenCalled();
    });
    it.each(['DeviceNotRegistered', 'InvalidCredentials'])(
      'handles ticket %s without deleting healthy devices',
      async (code) => {
        await reset();
        await registerPush(recipient, registration());
        await create();
        const transport = sender();
        vi.mocked(transport.send).mockResolvedValue([
          { status: 'error', details: { error: code } },
        ]);
        await processRemotePush(transport);
        expect(
          (await query('SELECT enabled FROM public.push_installations')).rows[0]
            .enabled
        ).toBe(code !== 'DeviceNotRegistered');
        expect(
          (await query('SELECT state,error_code FROM public.push_deliveries'))
            .rows[0]
        ).toMatchObject({ state: 'failed', error_code: code });
      }
    );
    it('invalidates DeviceNotRegistered receipts without deleting a newer account binding', async () => {
      await reset();
      const r = registration();
      await registerPush(recipient, r);
      await create();
      const transport = sender();
      await processRemotePush(transport);
      await registerPush(outsider, {
        ...r,
        account_guard: randomUUID(),
        revision: 2,
      });
      await query(
        "UPDATE public.push_deliveries SET next_attempt_at=now()-interval '1 second'"
      );
      vi.mocked(transport.receipts).mockImplementation(async (ids) =>
        Object.fromEntries(
          ids.map((id) => [
            id,
            { status: 'error', details: { error: 'DeviceNotRegistered' } },
          ])
        )
      );
      await processRemotePush(transport);
      expect(
        (await query('SELECT enabled,user_id FROM public.push_installations'))
          .rows[0]
      ).toMatchObject({ enabled: true, user_id: outsider });
    });
    it('bounds ticket retries and records permanent failure without disabling a valid token', async () => {
      await reset();
      await registerPush(recipient, registration());
      await create();
      await query('UPDATE public.push_deliveries SET attempts=7');
      const transport = sender();
      vi.mocked(transport.send).mockRejectedValue(
        new PushTransportError('Http429', true)
      );
      await processRemotePush(transport);
      expect(
        (await query('SELECT state,attempts FROM public.push_deliveries'))
          .rows[0]
      ).toMatchObject({ state: 'failed', attempts: 8 });
      expect(
        (await query('SELECT enabled FROM public.push_installations')).rows[0]
          .enabled
      ).toBe(true);
    });
    it('bounds missing receipt polling and cleans expired tokens without sending', async () => {
      await reset();
      await registerPush(recipient, registration());
      await create();
      const transport = sender();
      await processRemotePush(transport);
      await query(
        'UPDATE public.push_deliveries SET next_attempt_at=now(), receipt_attempts=23'
      );
      vi.mocked(transport.receipts).mockResolvedValue({});
      await processRemotePush(transport);
      expect(
        (await query('SELECT state,error_code FROM public.push_deliveries'))
          .rows[0]
      ).toMatchObject({ state: 'failed', error_code: 'ReceiptUnavailable' });
      await query(
        "UPDATE public.push_installations SET expires_at=now()-interval '1 second'"
      );
      await processRemotePush(transport);
      expect(
        (
          await query(
            'SELECT enabled,token_ciphertext FROM public.push_installations'
          )
        ).rows[0]
      ).toMatchObject({ enabled: false, token_ciphertext: null });
    });
    it('remote-disabled config does not register or invoke transport', async () => {
      await reset();
      vi.stubEnv('SPARKY_FITNESS_REMOTE_PUSH_ENABLED', 'false');
      expect((await registerPush(recipient, registration())).enabled).toBe(
        false
      );
      const transport = sender();
      await processRemotePush(transport);
      expect(transport.send).not.toHaveBeenCalled();
      vi.stubEnv('SPARKY_FITNESS_REMOTE_PUSH_ENABLED', 'true');
    });
  }
);
