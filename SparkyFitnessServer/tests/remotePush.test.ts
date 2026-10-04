import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { remotePushConfig } from '../utils/remotePushConfig.js';
import {
  createExpoPushTransport,
  PushTransportError,
  type InvitationPushMessage,
} from '../services/expoPushTransport.js';
import {
  invitationPushMessage,
  pushRetryDelay,
} from '../services/remotePushService.js';
import {
  pushRegistrationRequestSchema,
  remoteInvitationDataSchema,
} from '@workspace/shared';
const token = () => `ExpoPushToken[${randomBytes(16).toString('hex')}]`;
afterEach(() => vi.unstubAllEnvs());
it('defaults off and fails closed without a server access token', () => {
  expect(remotePushConfig({}).enabled).toBe(false);
  expect(() =>
    remotePushConfig({ SPARKY_FITNESS_REMOTE_PUSH_ENABLED: 'true' })
  ).toThrow('requires EXPO_ACCESS_TOKEN');
  expect(() =>
    remotePushConfig({ SPARKY_FITNESS_REMOTE_PUSH_ENABLED: 'yes' })
  ).toThrow();
  expect(
    remotePushConfig({
      SPARKY_FITNESS_REMOTE_PUSH_ENABLED: 'true',
      EXPO_ACCESS_TOKEN: randomBytes(32).toString('hex'),
    }).enabled
  ).toBe(true);
});
it('validates only self-registration input; no client user id or permission flags', () => {
  const input = {
    installation_id: randomUUID(),
    account_guard: randomUUID(),
    revision: 1,
    platform: 'ios',
    expo_push_token: token(),
  };
  expect(pushRegistrationRequestSchema.safeParse(input).success).toBe(true);
  for (const extra of [
    { user_id: randomUUID() },
    { enabled: true },
    { revision: -1 },
    { platform: 'watch' },
    { expo_push_token: 'bad' },
  ])
    expect(
      pushRegistrationRequestSchema.safeParse({ ...input, ...extra }).success
    ).toBe(false);
});
it('builds a generic, minimal payload without health/profile/name data', () => {
  const message = invitationPushMessage(
    {
      id: randomUUID(),
      event_id: randomUUID(),
      installation_id: randomUUID(),
      account_guard: randomUUID(),
      token_hash: '',
      challenge_id: randomUUID(),
      attempts: 1,
      token_ciphertext: '',
      token_iv: '',
      token_tag: '',
    },
    token()
  );
  expect(remoteInvitationDataSchema.safeParse(message.data).success).toBe(true);
  expect(Object.keys(message.data).sort()).toEqual([
    'accountGuard',
    'challengeId',
    'eventId',
    'type',
  ]);
  expect(message.body).toBe('You have a new Challenge invitation.');
  expect(message.categoryId).toBe('challenge');
});
describe('Expo HTTPS transport', () => {
  const message = {
    to: token(),
    title: 'SparkyRivals',
    body: 'You have a new Challenge invitation.',
    data: {
      type: 'challenge_invitation',
      challengeId: randomUUID(),
      eventId: randomUUID(),
      accountGuard: randomUUID(),
    },
    channelId: 'challenges',
    categoryId: 'challenge',
    sound: 'default',
    ttl: 3600,
  } satisfies InvitationPushMessage;
  it('authenticates send AND receipts with Bearer auth at the fixed Expo endpoint', async () => {
    const secret = randomBytes(32).toString('hex');
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ data: [{ status: 'ok', id: 'ticket' }] })
      )
      .mockResolvedValueOnce(
        Response.json({ data: { ticket: { status: 'ok' } } })
      );
    const api = createExpoPushTransport(secret, request);
    await expect(api.send([message])).resolves.toEqual([
      { status: 'ok', id: 'ticket' },
    ]);
    await expect(api.receipts(['ticket'])).resolves.toEqual({
      ticket: { status: 'ok' },
    });
    for (const [url, options] of request.mock.calls) {
      expect(String(url).startsWith('https://exp.host/--/api/v2/push/')).toBe(
        true
      );
      expect(options?.headers).toMatchObject({
        Authorization: `Bearer ${secret}`,
      });
      expect(options?.redirect).toBe('error');
    }
  });
  it.each([429, 500, 503])(
    'retries transient HTTP %i without exposing the response body',
    async (status) => {
      const api = createExpoPushTransport(
        'test-only',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response('private routing data', {
            status,
            headers: { 'retry-after': '45' },
          })
        )
      );
      await expect(api.send([message])).rejects.toMatchObject({
        code: `Http${status}`,
        retryable: true,
        retryAfterMs: 45000,
      });
    }
  );
  it.each([400, 401, 403])(
    'does not retry HTTP %i configuration errors',
    async (status) => {
      const api = createExpoPushTransport(
        'test-only',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('private routing data', { status }))
      );
      await expect(api.send([message])).rejects.toMatchObject({
        retryable: false,
      });
    }
  );
  it('handles enhanced-security UNAUTHORIZED and discards provider error messages', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ errors: [{ code: 'UNAUTHORIZED', message: token() }] })
      );
    await expect(
      createExpoPushTransport('test-only', request).send([message])
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', retryable: false });
  });
  it('validates batch limits before network IO', async () => {
    const request = vi.fn<typeof fetch>();
    const api = createExpoPushTransport('test-only', request);
    await expect(api.send(Array(101).fill(message))).rejects.toThrow('1–100');
    await expect(api.receipts(Array(1001).fill('id'))).rejects.toThrow(
      '1–1000'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('treats malformed/truncated and network responses as transient without logging tokens', async () => {
    for (const request of [
      vi.fn<typeof fetch>().mockRejectedValue(new Error(token())),
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] })),
    ]) {
      try {
        await createExpoPushTransport('test-only', request).send([message]);
        throw new Error('expected failure');
      } catch (error) {
        expect(error).toBeInstanceOf(PushTransportError);
        expect(String(error)).not.toContain('PushToken[');
      }
    }
  });
  it('caps retry backoff', () => {
    expect(pushRetryDelay(1)).toBe(30_000);
    expect(pushRetryDelay(8)).toBe(3600_000);
  });
});
