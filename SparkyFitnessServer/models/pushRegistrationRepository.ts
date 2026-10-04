import type { PoolClient } from 'pg';
import type {
  PushRegistrationRequest,
  PushUnregisterRequest,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';

export async function registerPushInstallation(
  actor: string,
  input: PushRegistrationRequest,
  encrypted: { hash: string; ciphertext: string; iv: string; tag: string }
) {
  const client: PoolClient = await getClient(actor, actor);
  try {
    const result = await client.query<{ expires_at: Date | null }>(
      'SELECT public.register_push_installation($1,$2,$3,$4,$5,$6,$7,$8) AS expires_at',
      [
        input.installation_id,
        input.platform,
        encrypted.hash,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        input.account_guard,
        input.revision,
      ]
    );
    return result.rows[0]!.expires_at;
  } finally {
    client.release();
  }
}
export async function revokePushInstallation(
  actor: string,
  input: PushUnregisterRequest
) {
  const client: PoolClient = await getClient(actor, actor);
  try {
    await client.query('SELECT public.revoke_push_installation($1,$2,$3)', [
      input.installation_id,
      input.account_guard,
      input.revision,
    ]);
  } finally {
    client.release();
  }
}
