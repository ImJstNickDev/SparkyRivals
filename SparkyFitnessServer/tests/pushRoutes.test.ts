import { beforeEach, it, expect, vi } from 'vitest';
import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
// @ts-expect-error no type declarations shipped for supertest
import request from 'supertest';
import router from '../routes/v2/pushRoutes.js';
import { registerPush } from '../services/pushRegistrationService.js';
import { revokePushInstallation } from '../models/pushRegistrationRepository.js';
import { log } from '../config/logging.js';
vi.mock('../services/pushRegistrationService.js', () => ({
  registerPush: vi.fn(),
}));
vi.mock('../models/pushRegistrationRepository.js', () => ({
  revokePushInstallation: vi.fn(),
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));
const actor = randomUUID();
const other = randomUUID();
const body = () => ({
  installation_id: randomUUID(),
  platform: 'android',
  expo_push_token: `ExpoPushToken[${randomBytes(16).toString('hex')}]`,
  account_guard: randomUUID(),
  revision: 1,
});
function app(user?: string, target = user) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    if (user) req.authenticatedUserId = user;
    if (target) req.userId = target;
    next();
  });
  a.use('/api/v2/push', router);
  return a;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(registerPush).mockResolvedValue({
    enabled: true,
    expires_at: new Date().toISOString(),
  });
  vi.mocked(revokePushInstallation).mockResolvedValue(undefined);
});
it('rejects unauthenticated and delegated registration', async () => {
  expect(
    (await request(app()).put('/api/v2/push/installation').send(body())).status
  ).toBe(401);
  expect(
    (
      await request(app(other, actor))
        .put('/api/v2/push/installation')
        .send(body())
    ).status
  ).toBe(403);
  expect(registerPush).not.toHaveBeenCalled();
});
it('never accepts spoofed user ownership, and does not echo token validation input', async () => {
  const input = body();
  const res = await request(app(actor))
    .put('/api/v2/push/installation')
    .send({ ...input, user_id: other });
  expect(res.status).toBe(400);
  expect(JSON.stringify(res.body)).not.toContain(input.expo_push_token);
  expect(registerPush).not.toHaveBeenCalled();
});
it('registers as authenticated actor and exposes only enabled/expiry', async () => {
  const input = body();
  const res = await request(app(actor))
    .put('/api/v2/push/installation')
    .send(input);
  expect(res.status).toBe(200);
  expect(registerPush).toHaveBeenCalledWith(actor, input);
  expect(Object.keys(res.body).sort()).toEqual(['enabled', 'expires_at']);
});
it('revokes idempotently with the actor and binding guard', async () => {
  const { installation_id, account_guard, revision } = body();
  const input = { installation_id, account_guard, revision };
  expect(
    (await request(app(actor)).delete('/api/v2/push/installation').send(input))
      .status
  ).toBe(204);
  expect(revokePushInstallation).toHaveBeenCalledWith(actor, input);
});
it('has no token list endpoint', async () => {
  expect(
    (await request(app(actor)).get('/api/v2/push/installation')).status
  ).toBe(404);
});
it('redacts repository exceptions rather than forwarding them to global logging', async () => {
  const input = body();
  vi.mocked(registerPush).mockRejectedValue(new Error(input.expo_push_token));
  const res = await request(app(actor))
    .put('/api/v2/push/installation')
    .send(input);
  expect(res.status).toBe(503);
  expect(JSON.stringify(res.body)).not.toContain(input.expo_push_token);
  expect(JSON.stringify(vi.mocked(log).mock.calls)).not.toContain(
    input.expo_push_token
  );
});
