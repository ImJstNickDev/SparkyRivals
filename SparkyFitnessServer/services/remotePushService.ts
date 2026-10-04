import type { PoolClient } from 'pg';
import { decrypt, ENCRYPTION_KEY } from '../security/encryption.js';
import { log } from '../config/logging.js';
import { remotePushConfig } from '../utils/remotePushConfig.js';
import {
  createExpoPushTransport,
  PushTransportError,
  safePushErrorCode,
  type PushTransport,
  type InvitationPushMessage,
  type ExpoPushResult,
} from './expoPushTransport.js';
import {
  withPushWorker,
  preparePushBatch,
  pendingReceipts,
  savePushOutcome,
  disablePushDevice,
  cleanupPushHistory,
  type PendingPush,
} from '../models/pushDeliveryRepository.js';

const RECEIPT_WAIT = 15 * 60_000;
export const pushRetryDelay = (attempts: number) =>
  Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3600_000);
export function invitationPushMessage(
  row: PendingPush,
  token: string
): InvitationPushMessage {
  return {
    to: token,
    title: 'SparkyRivals',
    body: 'You have a new Challenge invitation.',
    data: {
      type: 'challenge_invitation',
      challengeId: row.challenge_id,
      eventId: row.event_id,
      accountGuard: row.account_guard,
    },
    channelId: 'challenges',
    categoryId: 'challenge',
    sound: 'default',
    ttl: 3600,
  };
}
async function recordProviderFailure(
  client: PoolClient,
  row: PendingPush,
  result: ExpoPushResult
) {
  const code = safePushErrorCode(
    result.status === 'error' ? result.details?.error : undefined
  );
  if (code === 'DeviceNotRegistered') await disablePushDevice(client, row);
  const retry = code === 'MessageRateExceeded' && row.attempts < 8;
  await savePushOutcome(
    client,
    row.id,
    retry ? 'pending' : 'failed',
    code,
    pushRetryDelay(row.attempts)
  );
  log('warn', `[Push] Ticket failure: ${code}`);
}
/** Exported transport injection is only a test seam, never an env-configurable URL. */
export async function processRemotePush(transport?: PushTransport) {
  const config = remotePushConfig();
  if (!config.enabled) return;
  const sender = transport ?? createExpoPushTransport(config.accessToken);
  return withPushWorker(async (client) => {
    await cleanupPushHistory(client);
    const batch = await preparePushBatch(client);
    const rows: PendingPush[] = [];
    const messages: InvitationPushMessage[] = [];
    for (const row of batch) {
      try {
        const token = await decrypt(
          row.token_ciphertext,
          row.token_iv,
          row.token_tag,
          ENCRYPTION_KEY
        );
        if (!token) throw new Error('Missing routing token');
        rows.push(row);
        messages.push(invitationPushMessage(row, token));
      } catch {
        await savePushOutcome(client, row.id, 'failed', 'TokenDecryptFailed');
        log(
          'warn',
          '[Push] Token decryption failed; check persistent encryption key'
        );
      }
    }
    if (messages.length) {
      let tickets: ExpoPushResult[] | undefined;
      try {
        tickets = await sender.send(messages);
      } catch (error) {
        const failure =
          error instanceof PushTransportError
            ? error
            : new PushTransportError('TransportFailure', true);
        for (const row of rows)
          await savePushOutcome(
            client,
            row.id,
            failure.retryable && row.attempts < 8 ? 'pending' : 'failed',
            failure.code,
            Math.max(pushRetryDelay(row.attempts), failure.retryAfterMs)
          );
        log('warn', `[Push] Batch failure: ${failure.code}`);
      }
      if (tickets) {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          const ticket = tickets[i];
          if (ticket?.status === 'ok' && ticket.id)
            await savePushOutcome(
              client,
              row.id,
              'ticket',
              null,
              RECEIPT_WAIT,
              ticket.id
            );
          else
            await recordProviderFailure(
              client,
              row,
              ticket ?? { status: 'error' }
            );
        }
      }
    }
    const receipts = await pendingReceipts(client);
    if (!receipts.length) return;
    try {
      const results = await sender.receipts(receipts.map((r) => r.ticket_id));
      for (const row of receipts) {
        const result = results[row.ticket_id];
        if (!result) {
          if (
            Date.now() - row.ticket_at.getTime() >= 23 * 3600_000 ||
            row.receipt_attempts >= 24
          ) {
            await savePushOutcome(
              client,
              row.id,
              'failed',
              'ReceiptUnavailable'
            );
            log('warn', '[Push] Receipt unavailable after bounded polling');
          }
          continue;
        }
        if (result.status === 'ok')
          await savePushOutcome(client, row.id, 'delivered', null);
        else {
          const code = safePushErrorCode(result.details?.error);
          if (code === 'DeviceNotRegistered')
            await disablePushDevice(client, row);
          await savePushOutcome(
            client,
            row.id,
            code === 'MessageRateExceeded' && row.attempts < 8
              ? 'pending'
              : 'failed',
            code,
            pushRetryDelay(row.attempts)
          );
          log('warn', `[Push] Receipt failure: ${code}`);
        }
      }
    } catch (error) {
      const failure =
        error instanceof PushTransportError
          ? error
          : new PushTransportError('TransportFailure', true);
      for (const row of receipts)
        if (!failure.retryable || row.receipt_attempts >= 24)
          await savePushOutcome(client, row.id, 'failed', failure.code);
      log('warn', `[Push] Receipt lookup failure: ${failure.code}`);
    }
  });
}
