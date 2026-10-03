import * as WebBrowser from 'expo-web-browser';
import { createAuthClient } from 'better-auth/client';
import { expoClient } from '@better-auth/expo/client';
import {
  loginWithPasskey,
  loginWithOidc,
  addPasskey,
  deletePasskey,
  getAuthHeaders,
} from '../../src/services/api/authService';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { scheme: 'sparkyrivals-preview' } },
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  getCustomTabsSupportingBrowsersAsync: jest.fn(),
}));
jest.mock('better-auth/client', () => ({ createAuthClient: jest.fn() }));
jest.mock('@better-auth/expo/client', () => ({ expoClient: jest.fn() }));
jest.mock('@better-auth/sso/client', () => ({ ssoClient: jest.fn() }));

const browser = jest.mocked(WebBrowser.openAuthSessionAsync);
const fetchMock = jest.fn();
const callback = 'sparkyrivals-preview://oauth-callback';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ ticket: 'one-use-ticket' }),
  });
});

it('selects the configured native callback and parses only fragment credentials', async () => {
  browser.mockResolvedValue({
    type: 'success',
    url: `${callback}#token=t%2B%26&email=me%40example.test`,
  });
  await expect(loginWithPasskey('https://example.test')).resolves.toMatchObject(
    { sessionToken: 't+&', user: { email: 'me@example.test' } }
  );
  expect(browser).toHaveBeenCalledWith(
    'https://example.test/api/auth/web-login/passkey?app_scheme=sparkyrivals-preview',
    callback,
    expect.any(Object)
  );
});

it.each([
  'attacker://oauth-callback#token=t&email=me@example.test',
  'sparkyfitnessmobile://oauth-callback#token=t&email=me@example.test',
  `${callback}?token=t&email=me@example.test`,
  `${callback}/other#token=t&email=me@example.test`,
  `${callback}#token=t`,
])('rejects malformed/wrong callback %s', async (url) => {
  browser.mockResolvedValue({ type: 'success', url });
  await expect(loginWithPasskey('https://example.test')).rejects.toThrow();
});

it('keeps registration tickets in the fragment and session tokens out of browser URLs', async () => {
  browser.mockResolvedValue({
    type: 'success',
    url: `${callback}?status=success`,
  });
  await addPasskey('https://example.test', 'private-session-token', 'My key');
  const browserUrl = String(browser.mock.calls[0][0]);
  expect(browserUrl).toBe(
    'https://example.test/api/auth/web-login/register-passkey?app_scheme=sparkyrivals-preview#ticket=one-use-ticket&name=My%20key'
  );
  expect(browserUrl).not.toContain('private-session-token');
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
    'Bearer private-session-token'
  );
});

it('rejects registration success from another scheme', async () => {
  browser.mockResolvedValue({
    type: 'success',
    url: 'attacker://oauth-callback?status=success',
  });
  await expect(
    addPasskey('https://example.test', 'session', 'Key')
  ).rejects.toThrow('callback destination');
});

it('uses the native configured origin for passkey deletion', async () => {
  await deletePasskey('https://example.test', 'session', 'key-id');
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
    Origin: 'sparkyrivals-preview://',
    Authorization: 'Bearer session',
  });
});

it('configures the existing Better Auth SSO dance with the owned scheme', async () => {
  const signIn = jest.fn().mockResolvedValue({});
  const getSession = jest.fn().mockResolvedValue({
    data: {
      session: { token: 'sso-session' },
      user: { email: 'me@example.test' },
    },
  });
  jest.mocked(createAuthClient).mockReturnValue({
    signIn: { sso: signIn },
    getSession,
  } as unknown as ReturnType<typeof createAuthClient>);
  await expect(
    loginWithOidc('https://example.test', 'provider')
  ).resolves.toMatchObject({ sessionToken: 'sso-session' });
  expect(expoClient).toHaveBeenCalledWith(
    expect.objectContaining({ scheme: 'sparkyrivals-preview' })
  );
  expect(signIn).toHaveBeenCalledWith({
    providerId: 'provider',
    callbackURL: callback,
  });
});

it('retains API-key and session header behavior', () => {
  expect(
    getAuthHeaders({
      id: 'server',
      url: 'https://example.test',
      apiKey: 'api-key',
    })
  ).toEqual({ Authorization: 'Bearer api-key' });
  expect(
    getAuthHeaders({
      id: 'server',
      url: 'https://example.test',
      apiKey: 'api-key',
      authType: 'session',
      sessionToken: 'session',
    })
  ).toEqual({ Authorization: 'Bearer session' });
});
