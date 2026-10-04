import {
  RemotePushRegistration,
  type PushRegistrationDependencies,
} from '../../src/services/remotePushRegistration';
import {
  getCompanionChallengeSession,
  invalidateCompanionChallengeSession,
} from '../../src/services/companionChallengeSession';
import { type ServerConfig } from '../../src/services/storage';

jest.mock('../../src/services/notifications', () => ({
  getNotificationPermissionStatus: jest.fn(),
}));
jest.mock('../../src/services/storage', () => ({
  getActiveServerConfig: jest.fn(),
}));
jest.mock('../../src/services/api/pushApi', () => ({
  registerRemotePush: jest.fn(),
  unregisterRemotePush: jest.fn(),
}));
const config: ServerConfig = {
  id: 'config',
  url: 'https://example.test',
  apiKey: 'unit-test-only',
};
let state: string | null;
let deps: PushRegistrationDependencies;
let service: RemotePushRegistration;
let count = 0;
const uuid = () =>
  `00000000-0000-4000-8000-${(++count).toString().padStart(12, '0')}`;
const input = () => ({
  account: 'config:actor',
  configId: 'config',
  revision: getCompanionChallengeSession().revision,
  enabled: true,
});
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
beforeEach(() => {
  invalidateCompanionChallengeSession(false);
  state = null;
  deps = {
    read: jest.fn(async () => state),
    write: jest.fn(async (value) => {
      state = value;
    }),
    uuid,
    config: jest.fn(async () => config),
    permission: jest.fn(async () => 'granted'),
    token: jest.fn(async () => 'unit-test-routing-value'),
    supported: () => true,
    platform: () => 'ios',
    register: jest.fn(async () => ({
      enabled: true,
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    })),
    unregister: jest.fn(async () => null),
    now: Date.now,
    warn: jest.fn(),
  };
  service = new RemotePushRegistration(deps);
});
it('does not obtain a token or register until preferences and OS permission permit it', async () => {
  await service.reconcile({ ...input(), enabled: false });
  expect(deps.token).not.toHaveBeenCalled();
  jest.mocked(deps.permission).mockResolvedValue('denied');
  await service.reconcile(input());
  await service.settled();
  expect(deps.register).not.toHaveBeenCalled();
});
it('registers idempotently and renews its seven-day lease on subsequent foreground observations', async () => {
  await service.reconcile(input());
  await service.reconcile(input());
  expect(deps.register).toHaveBeenCalledTimes(1);
  expect(service.isActive(input().account)).toBe(true);
  deps.now = () => Date.now() + 2 * 86400_000;
  await service.reconcile(input());
  expect(deps.register).toHaveBeenCalledTimes(2);
});
it('persists the random installation and monotonic revision in secure storage before network IO', async () => {
  deps.register = jest.fn(async (_config, body) => {
    const stored = JSON.parse(state!);
    expect(stored.installation).toBe(body.installation_id);
    expect(stored.revision).toBe(body.revision);
    return {
      enabled: true,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    };
  });
  await service.reconcile(input());
  expect(deps.register).toHaveBeenCalled();
  expect(state).not.toContain(config.apiKey);
});
it('rotates binding guard on token change', async () => {
  await service.reconcile(input());
  const first = jest.mocked(deps.register).mock.calls[0][1];
  jest.mocked(deps.token).mockResolvedValue('changed-unit-test-value');
  await service.reconcile(input(), true);
  const second = jest.mocked(deps.register).mock.calls[1][1];
  expect(second.account_guard).not.toBe(first.account_guard);
  expect(second.installation_id).toBe(first.installation_id);
  expect(second.revision).toBeGreaterThan(first.revision);
});
it.each(['logout', 'permission', 'preferences'])(
  'revokes promptly on %s and clears the local guard before IO',
  async (reason) => {
    await service.reconcile(input());
    if (reason === 'permission') {
      jest.mocked(deps.permission).mockResolvedValue('denied');
      await service.reconcile(input());
    } else if (reason === 'preferences')
      await service.reconcile({ ...input(), enabled: false });
    else {
      const clearing = service.clear();
      expect(service.isActive(input().account)).toBe(false);
      await clearing;
    }
    await service.settled();
    expect(deps.unregister).toHaveBeenCalledTimes(1);
    expect(service.isActive(input().account)).toBe(false);
  }
);
it('recovers on re-enable without resurrecting the old notification guard', async () => {
  await service.reconcile(input());
  const old = jest.mocked(deps.register).mock.calls[0][1].account_guard;
  await service.clear();
  await service.reconcile(input());
  expect(service.isActive(input().account)).toBe(true);
  expect(service.matchesGuard(old)).toBe(false);
});
it('revokes the captured old server and registers the new account separately', async () => {
  await service.reconcile(input());
  await service.clear();
  const next = { ...config, id: 'other', url: 'https://other.test' };
  jest.mocked(deps.config).mockResolvedValue(next);
  await service.reconcile({
    ...input(),
    configId: 'other',
    account: 'other:actor',
  });
  expect(deps.unregister).toHaveBeenCalledWith(config, expect.any(Object));
  expect(deps.register).toHaveBeenLastCalledWith(next, expect.any(Object));
  expect(service.isActive('config:actor')).toBe(false);
});
it('cannot dispatch obsolete registration after token acquisition crosses an account switch', async () => {
  let resolve!: (value: string) => void;
  deps.token = jest.fn(
    () =>
      new Promise<string>((r) => {
        resolve = r;
      })
  );
  const pending = service.reconcile(input());
  await tick();
  const cleared = service.clear();
  resolve('old-unit-test-token');
  await pending;
  await cleared;
  expect(deps.register).not.toHaveBeenCalled();
});
it('revokes an in-flight registration with a strictly newer revision', async () => {
  let resolve!: (value: { enabled: boolean; expires_at: string }) => void;
  deps.register = jest.fn(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const pending = service.reconcile(input());
  await tick();
  const cleared = service.clear();
  resolve({
    enabled: true,
    expires_at: new Date(Date.now() + 86400_000).toISOString(),
  });
  await pending;
  await cleared;
  expect(service.isActive(input().account)).toBe(false);
  expect(
    jest.mocked(deps.unregister).mock.calls[0][1].revision
  ).toBeGreaterThan(jest.mocked(deps.register).mock.calls[0][1].revision);
});
it('falls back without logging token/error details after provider or server failure', async () => {
  jest
    .mocked(deps.register)
    .mockRejectedValue(new Error('private-routing-value'));
  await service.reconcile(input());
  expect(service.isActive(input().account)).toBe(false);
  expect(deps.warn).toHaveBeenCalledWith();
});
it('does not register unsupported variants or persist a replacement identity after storage failure', async () => {
  deps.supported = () => false;
  await service.reconcile(input());
  expect(deps.register).not.toHaveBeenCalled();
  deps.supported = () => true;
  const other = new RemotePushRegistration({
    ...deps,
    read: jest.fn().mockRejectedValue(new Error('storage')),
  });
  await other.reconcile(input());
  expect(deps.register).not.toHaveBeenCalled();
});
it('validates a cold-launch guard against secure state, permission and current server', async () => {
  await service.reconcile(input());
  const guard = jest.mocked(deps.register).mock.calls[0][1].account_guard;
  const restored = new RemotePushRegistration(deps);
  await expect(restored.accountForGuard(guard)).resolves.toBe(input().account);
  await expect(restored.accountForGuard(uuid())).resolves.toBeNull();
  jest.mocked(deps.config).mockResolvedValue({ ...config, id: 'other' });
  await expect(restored.accountForGuard(guard)).resolves.toBeNull();
});

it('retains a verified lease when renewal is offline, preventing duplicate local fallback', async () => {
  await service.reconcile(input());
  deps.now = () => Date.now() + 2 * 86400_000;
  jest.mocked(deps.register).mockRejectedValue(new Error('offline'));
  await service.reconcile(input());
  expect(service.isActive(input().account)).toBe(true);
  deps.now = () => Date.now() + 8 * 86400_000;
  await service.reconcile(input());
  expect(service.isActive(input().account)).toBe(false);
});
