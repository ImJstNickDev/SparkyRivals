import express from 'express';
// @ts-expect-error TS(7016): upstream has no supertest declaration package
import request from 'supertest';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  getMobileAuthOrigins,
  resolveMobileAuthCallback,
} from '../utils/mobileAuthCallbacks.js';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../auth.js', () => ({
  default: { auth: { api: { getSession }, options: {} } },
}));
vi.mock('../utils/bearerAuthBridge.js', () => ({
  bridgeBearerAuthHeader: vi.fn(),
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('native callback configuration', () => {
  it('retains the upstream callback by default', () => {
    vi.stubEnv('SPARKY_FITNESS_MOBILE_AUTH_SCHEMES', '');
    expect(getMobileAuthOrigins()).toEqual(['sparkyfitnessmobile://']);
    expect(resolveMobileAuthCallback(undefined)).toEqual({
      url: 'sparkyfitnessmobile://oauth-callback',
      bridgePath: '/api/auth/web-login/callback',
    });
    expect(resolveMobileAuthCallback('sparkyrivals')).toBeNull();
  });

  it.each([
    'https',
    'javascript',
    'evil://callback',
    'good,,bad',
    '*',
    'wrong/scheme',
    'bad\nname',
  ])('rejects malformed server configuration %s', (value) => {
    vi.stubEnv('SPARKY_FITNESS_MOBILE_AUTH_SCHEMES', value);
    expect(() => getMobileAuthOrigins()).toThrow(
      'SPARKY_FITNESS_MOBILE_AUTH_SCHEMES'
    );
  });

  it('accepts only explicitly configured schemes, not arbitrary callback URLs', () => {
    vi.stubEnv(
      'SPARKY_FITNESS_MOBILE_AUTH_SCHEMES',
      'sparkyrivals, sparkyrivals-dev, sparkyrivals-preview'
    );
    expect(getMobileAuthOrigins()).toContain('sparkyrivals-preview://');
    expect(resolveMobileAuthCallback('sparkyrivals-preview')?.url).toBe(
      'sparkyrivals-preview://oauth-callback'
    );
    for (const value of [
      'https://evil.example',
      'sparkyrivals://oauth-callback',
      'sparkyrivals-attacker',
      '',
      ['sparkyrivals'],
      { scheme: 'sparkyrivals' },
    ]) {
      expect(resolveMobileAuthCallback(value)).toBeNull();
    }
  });
});

describe('mobile browser return routes', () => {
  const app = express();
  beforeAll(async () => {
    const { default: router } =
      await import('../routes/auth/authCoreRoutes.js');
    app.use('/api/auth', router);
  });
  beforeEach(() => {
    vi.stubEnv(
      'SPARKY_FITNESS_MOBILE_AUTH_SCHEMES',
      'sparkyrivals,sparkyrivals-dev,sparkyrivals-preview'
    );
    getSession.mockResolvedValue({
      session: { token: 'token +&/#?=' },
      user: { email: 'me+test@example.test', role: 'admin' },
    });
  });

  it.each([
    undefined,
    'sparkyfitnessmobile',
    'sparkyrivals',
    'sparkyrivals-dev',
    'sparkyrivals-preview',
  ])('returns session details only in the fragment for %s', async (scheme) => {
    const response = await request(app)
      .get('/api/auth/web-login/callback')
      .query(scheme ? { app_scheme: scheme } : {});
    expect(response.status).toBe(302);
    expect(response.headers['cache-control']).toBe('no-store');
    const url = new URL(response.headers.location);
    expect(`${url.protocol}//${url.host}`).toBe(
      `${scheme || 'sparkyfitnessmobile'}://oauth-callback`
    );
    expect(url.search).toBe('');
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get('token')).toBe('token +&/#?=');
    expect(fragment.get('email')).toBe('me+test@example.test');
    expect(fragment.get('role')).toBe('admin');
  });

  it.each(['passkey', 'register-passkey', 'callback'])(
    'rejects untrusted/malformed selectors on %s before reading the session',
    async (page) => {
      for (const app_scheme of [
        'attacker',
        'https://evil.example',
        'sparkyrivals://oauth-callback?token=evil',
        'sparkyrivals\n',
        '',
      ]) {
        const response = await request(app)
          .get(`/api/auth/web-login/${page}`)
          .query({ app_scheme });
        expect(response.status).toBe(400);
        expect(response.headers.location).toBeUndefined();
      }
      expect(getSession).not.toHaveBeenCalled();
    }
  );

  it('rejects repeated query selectors', async () => {
    expect(
      (
        await request(app).get(
          '/api/auth/web-login/callback?app_scheme=sparkyrivals&app_scheme=attacker'
        )
      ).status
    ).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('requires an authenticated session even with an allowed destination', async () => {
    getSession.mockResolvedValue(null);
    expect(
      (
        await request(app).get(
          '/api/auth/web-login/callback?app_scheme=sparkyrivals'
        )
      ).status
    ).toBe(400);
  });

  it('renders matching login and registration return paths', async () => {
    const login = await request(app).get(
      '/api/auth/web-login/passkey?app_scheme=sparkyrivals-preview'
    );
    expect(login.status).toBe(200);
    expect(login.text).toContain(
      '/api/auth/web-login/callback?app_scheme=sparkyrivals-preview'
    );
    expect(login.text).not.toContain('__MOBILE_LOGIN_CALLBACK__');
    const register = await request(app).get(
      '/api/auth/web-login/register-passkey?app_scheme=sparkyrivals-preview'
    );
    expect(register.status).toBe(200);
    expect(register.text).toContain(
      'sparkyrivals-preview://oauth-callback?status=success'
    );
    expect(register.text).not.toContain('__MOBILE_CALLBACK_URL__');
    expect(register.text).toContain('redeem-ticket');
  });
});
