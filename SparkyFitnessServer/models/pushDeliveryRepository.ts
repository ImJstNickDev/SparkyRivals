import type { PoolClient } from 'pg';
import { getSystemClient } from '../db/poolManager.js';

export interface PendingPush {
  id: string;
  event_id: string;
  installation_id: string;
  account_guard: string;
  token_hash: string;
  challenge_id: string;
  attempts: number;
  token_ciphertext: string;
  token_iv: string;
  token_tag: string;
}
export interface PendingReceipt {
  id: string;
  installation_id: string;
  account_guard: string;
  token_hash: string;
  ticket_id: string;
  ticket_at: Date;
  receipt_attempts: number;
  attempts: number;
}
/** Background job only. One session lock prevents duplicate workers across
 * replicas. Attempts commit before network IO; locks release even after errors. */
export async function withPushWorker<T>(
  run: (client: PoolClient) => Promise<T>
): Promise<T | null> {
  const client: PoolClient = await getSystemClient();
  let locked = false;
  try {
    locked = (
      await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(82451, 2) AS locked'
      )
    ).rows[0]!.locked;
    return locked ? await run(client) : null;
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(82451, 2)');
      client.release();
    } catch {
      client.release(true); // Never return a potentially locked session to the pool.
    }
  }
}
export async function preparePushBatch(
  client: PoolClient
): Promise<PendingPush[]> {
  await client.query(`UPDATE public.push_deliveries d SET state='suppressed',updated_at=now(),error_code='Ineligible'
    FROM public.push_events e WHERE d.event_id=e.id AND d.state='pending' AND (
      e.created_at < now()-interval '24 hours' OR NOT EXISTS (
        SELECT 1 FROM public.push_installations i JOIN public.challenge_participants cp ON cp.user_id=i.user_id
        JOIN public.challenges c ON c.id=cp.challenge_id
        WHERE i.installation_id=d.installation_id AND i.enabled AND i.expires_at>now()
        AND i.account_guard=d.account_guard AND i.token_hash=d.token_hash
        AND cp.challenge_id=e.challenge_id AND cp.user_id=e.user_id AND cp.status='pending'
        AND c.cancelled_at IS NULL AND (now() AT TIME ZONE c.timezone)::date<=c.end_date))`);
  const result =
    await client.query<PendingPush>(`UPDATE public.push_deliveries d
    SET attempts=d.attempts+1, next_attempt_at=now()+interval '2 minutes', updated_at=now()
    FROM (SELECT id FROM public.push_deliveries WHERE state='pending' AND next_attempt_at<=now() AND attempts<8
      ORDER BY next_attempt_at,id LIMIT 100) due, public.push_installations i, public.push_events e
    WHERE d.id=due.id AND i.installation_id=d.installation_id AND e.id=d.event_id
    RETURNING d.id,d.event_id,d.installation_id,d.account_guard,d.token_hash,d.attempts,e.challenge_id,
      i.token_ciphertext,i.token_iv,i.token_tag`);
  return result.rows;
}
export async function pendingReceipts(client: PoolClient) {
  return (
    await client.query<PendingReceipt>(`UPDATE public.push_deliveries d SET receipt_attempts=d.receipt_attempts+1,
    next_attempt_at=now()+interval '15 minutes',updated_at=now()
    FROM (SELECT id FROM public.push_deliveries WHERE state='ticket' AND next_attempt_at<=now()
      ORDER BY next_attempt_at,id LIMIT 1000) due WHERE d.id=due.id
    RETURNING d.id,d.installation_id,d.account_guard,d.token_hash,d.ticket_id,d.ticket_at,d.receipt_attempts,d.attempts`)
  ).rows;
}
export async function savePushOutcome(
  client: PoolClient,
  id: string,
  state: 'pending' | 'ticket' | 'delivered' | 'failed',
  code: string | null,
  delayMs = 0,
  ticket?: string
) {
  await client.query(
    `UPDATE public.push_deliveries SET state=$2,error_code=$3,next_attempt_at=now()+($4 * interval '1 millisecond'),
    ticket_id=COALESCE($5,ticket_id),ticket_at=CASE WHEN $5::text IS NOT NULL THEN now() ELSE ticket_at END,updated_at=now() WHERE id=$1`,
    [id, state, code, delayMs, ticket ?? null]
  );
}
export async function disablePushDevice(
  client: PoolClient,
  row: Pick<PendingPush, 'installation_id' | 'account_guard' | 'token_hash'>
) {
  await client.query(
    `UPDATE public.push_installations SET enabled=false,token_hash=NULL,token_ciphertext=NULL,token_iv=NULL,token_tag=NULL,updated_at=now()
    WHERE installation_id=$1 AND account_guard=$2 AND token_hash=$3`,
    [row.installation_id, row.account_guard, row.token_hash]
  );
}
export async function cleanupPushHistory(client: PoolClient) {
  await client.query(
    "UPDATE public.push_deliveries SET state='failed',error_code='RetryLimit',updated_at=now() WHERE state='pending' AND attempts>=8"
  );
  await client.query(
    'UPDATE public.push_installations SET enabled=false,token_hash=NULL,token_ciphertext=NULL,token_iv=NULL,token_tag=NULL WHERE enabled AND expires_at<=now()'
  );
  await client.query(
    "DELETE FROM public.push_events WHERE created_at<now()-interval '30 days'"
  );
  // Retain revision tombstones so delayed registration requests cannot resurrect
  // a revoked installation. They contain no routing token after expiry/revoke;
  // RPCs bound the registry to 100 installation identities per user (20 active).
}
