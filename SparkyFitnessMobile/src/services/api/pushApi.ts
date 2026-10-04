import {
  pushRegistrationResponseSchema,
  type PushRegistrationRequest,
  type PushUnregisterRequest,
} from '@workspace/shared';
import { type ServerConfig, proxyHeadersToRecord } from '../storage';
import { getAuthHeaders } from './authService';
import { normalizeUrl } from '../../utils/serverUrl';
import { fetchWithTimeout } from '../../utils/concurrency';

/** Captured authenticated destination: never resolve the *new* active account
 * while revoking the previous one. No body/error logging for routing tokens. */
async function pushRequest(
  config: ServerConfig,
  method: 'PUT' | 'DELETE',
  body: PushRegistrationRequest | PushUnregisterRequest
) {
  const base = normalizeUrl(config.url);
  if (!__DEV__ && !base.toLowerCase().startsWith('https://'))
    throw new Error('Push registration requires HTTPS');
  const response = await fetchWithTimeout(
    `${base}/api/v2/push/installation`,
    {
      method,
      credentials: 'omit',
      headers: {
        ...proxyHeadersToRecord(config.proxyHeaders),
        ...getAuthHeaders(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    method === 'DELETE' ? 4000 : 10_000
  );
  if (!response.ok) throw new Error('Push registration unavailable');
  if (method === 'DELETE') return null;
  return pushRegistrationResponseSchema.parse(await response.json());
}
export const registerRemotePush = (
  config: ServerConfig,
  body: PushRegistrationRequest
) => pushRequest(config, 'PUT', body);
export const unregisterRemotePush = (
  config: ServerConfig,
  body: PushUnregisterRequest
) => pushRequest(config, 'DELETE', body);
