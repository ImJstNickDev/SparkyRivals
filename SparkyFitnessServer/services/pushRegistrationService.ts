import { createHash } from 'node:crypto';
import type { PushRegistrationRequest } from '@workspace/shared';
import { encrypt, ENCRYPTION_KEY } from '../security/encryption.js';
import { registerPushInstallation } from '../models/pushRegistrationRepository.js';
import { remotePushConfig } from '../utils/remotePushConfig.js';

export async function registerPush(
  actor: string,
  input: PushRegistrationRequest
) {
  if (!remotePushConfig().enabled) return { enabled: false, expires_at: null };
  const encrypted = await encrypt(input.expo_push_token, ENCRYPTION_KEY);
  if (!encrypted.encryptedText || !encrypted.iv || !encrypted.tag)
    throw new Error('Token encryption failed');
  const expires = await registerPushInstallation(actor, input, {
    hash: createHash('sha256').update(input.expo_push_token).digest('hex'),
    ciphertext: encrypted.encryptedText,
    iv: encrypted.iv,
    tag: encrypted.tag,
  });
  return { enabled: !!expires, expires_at: expires?.toISOString() ?? null };
}
