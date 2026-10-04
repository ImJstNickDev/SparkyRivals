import { z } from 'zod';
import type { remoteInvitationDataSchema } from '@workspace/shared';

export interface InvitationPushMessage {
  to: string;
  title: 'SparkyRivals';
  body: 'You have a new Challenge invitation.';
  data: z.infer<typeof remoteInvitationDataSchema>;
  channelId: 'challenges';
  categoryId: 'challenge';
  sound: 'default';
  ttl: number;
}
const resultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.string().max(256).optional() }),
  z.object({
    status: z.literal('error'),
    details: z.object({ error: z.string() }).optional(),
  }),
]);
export type ExpoPushResult = z.infer<typeof resultSchema>;
const errorCodes = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'MessageRateExceeded',
  'MismatchSenderId',
  'InvalidCredentials',
  'UNAUTHORIZED',
  'TOO_MANY_REQUESTS',
]);
export const safePushErrorCode = (code: string | undefined) =>
  errorCodes.has(code ?? '') ? code! : 'ProviderError';
export class PushTransportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs = 0
  ) {
    super(code);
  }
}
export interface PushTransport {
  send(messages: InvitationPushMessage[]): Promise<ExpoPushResult[]>;
  receipts(ids: string[]): Promise<Record<string, ExpoPushResult>>;
}
/** Documented Expo HTTPS API. Fixed origin; no configurable token-exfiltration
 * host. Tests inject fetch in-process and never contact Expo. No response bodies
 * or native error messages are exposed to callers/logs. */
export function createExpoPushTransport(
  accessToken: string,
  request: typeof fetch = fetch
): PushTransport {
  if (!accessToken) throw new Error('Expo access token required');
  async function post(
    path: 'send' | 'getReceipts',
    body: unknown
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await request(`https://exp.host/--/api/v2/push/${path}`, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PushTransportError('NetworkError', true);
    }
    if (!response.ok) {
      const retry = response.status === 429 || response.status >= 500;
      const header = response.headers.get('retry-after');
      const seconds = header && /^\d+$/.test(header) ? Number(header) : 0;
      throw new PushTransportError(
        `Http${response.status}`,
        retry,
        Math.min(seconds * 1000, 3600_000)
      );
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new PushTransportError('InvalidResponse', true);
    }
    const envelope = z
      .object({
        data: z.unknown().optional(),
        errors: z.array(z.object({ code: z.string() })).optional(),
      })
      .safeParse(json);
    if (!envelope.success)
      throw new PushTransportError('InvalidResponse', true);
    if (envelope.data.errors?.length) {
      const code = safePushErrorCode(envelope.data.errors[0]!.code);
      throw new PushTransportError(code, code === 'TOO_MANY_REQUESTS');
    }
    return envelope.data.data;
  }
  return {
    async send(messages) {
      if (!messages.length || messages.length > 100)
        throw new Error('Push batch must contain 1–100 messages');
      const result = z
        .array(resultSchema)
        .safeParse(await post('send', messages));
      if (!result.success || result.data.length !== messages.length)
        throw new PushTransportError('InvalidResponse', true);
      return result.data;
    },
    async receipts(ids) {
      if (!ids.length || ids.length > 1000)
        throw new Error('Receipt batch must contain 1–1000 ids');
      const result = z
        .record(z.string(), resultSchema)
        .safeParse(await post('getReceipts', { ids }));
      if (!result.success)
        throw new PushTransportError('InvalidResponse', true);
      return result.data;
    },
  };
}
