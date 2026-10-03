import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
// @ts-expect-error TS(7016): no type declarations shipped for cookie-parser
import cookieParser from 'cookie-parser';
// @ts-expect-error TS(7016): no type declarations shipped for supertest
import request from 'supertest';
import service from '../services/challengeService.js';
import router from '../routes/v2/challengeRoutes.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { ChallengeError } from '../utils/challengeErrors.js';
import { challengeOpenApiSchemas } from '../schemas/challengeSchemas.js';
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../auth.js', () => ({ auth: { api: { getSession } } }));
vi.mock('../models/userRepository.js', () => ({
  default: {
    ensureUserInitialization: vi.fn().mockResolvedValue(undefined),
    updateUserLastLogin: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../utils/permissionUtils.js', () => ({
  canAccessUserData: vi.fn().mockResolvedValue(true),
}));
vi.mock('../utils/apiKeySessionCache.js', () => ({
  getCachedSession: vi.fn().mockReturnValue(null),
  setCachedSession: vi.fn(),
}));
vi.mock('../services/challengeService.js', () => ({
  default: {
    create: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
    invite: vi.fn(),
    respond: vi.fn(),
    update: vi.fn(),
  },
}));
const actor = '10000000-0000-4000-8000-000000000001';
const peer = '10000000-0000-4000-8000-000000000002';
const id = '20000000-0000-4000-8000-000000000001';
const url = '/api/v2/challenges';
const app = express();
app.use(express.json(), cookieParser(), authenticate);
app.use(url, router);
const errorHandler: express.ErrorRequestHandler = (
  _error,
  _req,
  res,
  _next
) => {
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);
beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({
    user: { id: actor, name: 'Owner', lastLoginAt: new Date().toISOString() },
    session: { id: 'session' },
  });
  vi.mocked(service.create).mockResolvedValue({ challenge: { id } } as Awaited<
    ReturnType<typeof service.create>
  >);
  vi.mocked(service.detail).mockResolvedValue({ challenge: { id } } as Awaited<
    ReturnType<typeof service.detail>
  >);
  vi.mocked(service.list).mockResolvedValue({
    challenges: [],
    limit: 20,
    offset: 0,
    has_more: false,
  });
});

describe('Challenge typed routes and authentication', () => {
  it.each(['cookie', 'x-api-key'])(
    'uses existing %s authentication',
    async (header) => {
      const response = await request(app)
        .get(url)
        .set(
          header,
          header === 'cookie'
            ? 'better-auth.session_token=test-session'
            : 'a'.repeat(64)
        );
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(service.list).toHaveBeenCalledWith(actor, {
        limit: 20,
        offset: 0,
      });
      expect(getSession).toHaveBeenCalled();
    }
  );
  it('rejects unauthenticated requests before services', async () => {
    getSession.mockResolvedValue(null);
    expect((await request(app).get(url)).status).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('rejects switched context even with valid family permissions', async () => {
    expect(
      (
        await request(app)
          .get(url)
          .set('Cookie', `sparky_active_user_id=${peer}`)
      ).status
    ).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('creates using the actor, not a client-supplied owner', async () => {
    const body = {
      name: 'Daily steps',
      start_date: '2026-10-04',
      end_date: '2026-10-10',
      timezone: 'Europe/Rome',
    };
    expect((await request(app).post(url).send(body)).status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        metric: 'steps',
        scoring_mode: 'sum',
        participant_ids: [],
      })
    );
    expect(
      (
        await request(app)
          .post(url)
          .send({ ...body, creator_user_id: peer })
      ).status
    ).toBe(400);
  });
  it.each(['not-a-uuid', '123', 'user@example.test'])(
    'rejects malformed id %s',
    async (invalid) => {
      expect((await request(app).get(`${url}/${invalid}`)).status).toBe(400);
      expect(service.detail).not.toHaveBeenCalled();
    }
  );
  it('has no global account discovery, query injection or arbitrary on-behalf-of selector', async () => {
    for (const query of [
      'search=test',
      'user_id=' + peer,
      'limit=1000',
      'offset=-1',
      'limit=one',
    ])
      expect((await request(app).get(`${url}?${query}`)).status).toBe(400);
    expect((await request(app).get(`${url}/users`)).status).toBe(400);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('fetches detail and returns identical absent/inaccessible errors', async () => {
    expect((await request(app).get(`${url}/${id}`)).status).toBe(200);
    vi.mocked(service.detail).mockRejectedValue(
      new ChallengeError(404, 'Challenge not found')
    );
    expect((await request(app).get(`${url}/${id}`)).body).toEqual({
      error: 'Challenge not found',
    });
  });
  it('invites by strict user ID contract', async () => {
    expect(
      (
        await request(app)
          .post(`${url}/${id}/invitations`)
          .send({ user_id: peer })
      ).status
    ).toBe(201);
    expect(service.invite).toHaveBeenCalledWith(actor, id, peer);
    expect(
      (
        await request(app)
          .post(`${url}/${id}/invitations`)
          .send({ email: 'private@example.test' })
      ).status
    ).toBe(400);
  });
  it.each(['accept', 'decline', 'leave'] as const)(
    '%s always operates on actor only',
    async (action) => {
      expect(
        (await request(app).post(`${url}/${id}/${action}`).send({})).status
      ).toBe(204);
      expect(service.respond).toHaveBeenCalledWith(actor, id, action);
      expect(
        (
          await request(app)
            .post(`${url}/${id}/${action}`)
            .send({ user_id: peer })
        ).status
      ).toBe(400);
    }
  );
  it('supports creator rename/cancel but no rule edits', async () => {
    expect(
      (await request(app).patch(`${url}/${id}`).send({ name: 'New name' }))
        .status
    ).toBe(200);
    expect(service.update).toHaveBeenCalledWith(actor, id, {
      name: 'New name',
    });
    expect(
      (
        await request(app)
          .patch(`${url}/${id}`)
          .send({ start_date: '2027-01-01' })
      ).status
    ).toBe(400);
    expect(
      (await request(app).post(`${url}/${id}/cancel`).send({})).status
    ).toBe(200);
    expect(service.update).toHaveBeenCalledWith(actor, id, { cancel: true });
  });
  it('uses the shared Zod contract for OpenAPI', () => {
    expect(challengeOpenApiSchemas.CreateChallenge.properties).toHaveProperty(
      'participant_ids'
    );
    expect(challengeOpenApiSchemas.ChallengeDetail.properties).toHaveProperty(
      'participants'
    );
  });
});
