import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';
import { TimeoutError, withTimeout } from '../utils/concurrency';
import translation from '../localization/i18n';
import { getNotificationPermissionStatus } from './notifications';
import { getActiveServerConfig, type ServerConfig } from './storage';
import {
  getCompanionChallengeSession,
  subscribeCompanionChallengeSession,
} from './companionChallengeSession';
import { registerRemotePush, unregisterRemotePush } from './api/pushApi';
import {
  setRemotePushIdentityCleanup,
  setRemotePushAccountResolver,
} from './remotePushIdentity';
import { addLog } from './LogService';
import { useAppPreferencesStore } from '../stores/appPreferencesStore';

const KEY = 'sparkyrivals.remote-push.v1';
const schema = z.object({
  installation: z.uuid(),
  revision: z.number().int().nonnegative(),
  binding: z
    .object({
      account: z.string(),
      configId: z.string(),
      guard: z.uuid(),
      token: z.string(),
      expires: z.number(),
      enabled: z.boolean(),
    })
    .nullable(),
});
type Saved = z.infer<typeof schema>;
type RegistrationStage =
  | 'cleanup'
  | 'permission'
  | 'configuration'
  | 'secure-read'
  | 'token'
  | 'secure-write'
  | 'register';
// Provider error messages can contain routing tokens or response bodies. Only
// these fixed codes may leave the registration boundary, never the error itself.
const SAFE_FAILURE_CODES = [
  'E_REGISTRATION_FAILED',
  'ERR_NOTIFICATIONS_NETWORK_ERROR',
  'ERR_NOTIFICATIONS_SERVER_ERROR',
  'ERR_NOTIFICATIONS_NO_EXPERIENCE_ID',
  'ERR_NOTIFICATIONS_NO_APPLICATION_ID',
  'ERR_NOTIF_DEVICE_ID',
  'ERR_SECURESTORE_READ_ERROR',
  'ERR_SECURESTORE_WRITE_ERROR',
] as const;
function registrationFailureCode(error: unknown) {
  if (error instanceof TimeoutError) return 'timeout';
  if (typeof error !== 'object' || error === null) return 'unavailable';
  const code = 'code' in error ? error.code : undefined;
  return SAFE_FAILURE_CODES.find((value) => value === code) ?? 'unavailable';
}
export interface PushEligibility {
  account: string;
  configId: string;
  revision: number;
  enabled: boolean;
}
export interface PushRegistrationDependencies {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  uuid(): string;
  config(): Promise<ServerConfig | null>;
  permission(): Promise<string>;
  token(devicePushToken?: Notifications.DevicePushToken): Promise<string>;
  supported(): boolean;
  platform(): 'ios' | 'android';
  register: typeof registerRemotePush;
  unregister: typeof unregisterRemotePush;
  now(): number;
  warn(stage: RegistrationStage, code: string): void;
}
/** Serial, durable installation revisions stop an old in-flight upsert from
 * resurrecting an account after a newer revoke/transfer reaches the server. */
export class RemotePushRegistration {
  private queue: Promise<void> = Promise.resolve();
  private epoch = 0;
  private clearing = false;
  private saved: Saved | undefined;
  private lastConfig: ServerConfig | undefined;
  private active: { account: string; guard: string; expires: number } | null =
    null;
  private listeners = new Set<() => void>();
  constructor(private readonly deps: PushRegistrationDependencies) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(value: typeof this.active) {
    this.active = value;
    if (value) this.clearing = false;
    for (const listener of this.listeners) listener();
  }
  isActive(account: string) {
    return (
      this.active?.account === account && this.active.expires > this.deps.now()
    );
  }
  matchesGuard(guard: string) {
    return (
      this.active?.guard === guard && this.active.expires > this.deps.now()
    );
  }
  async settled() {
    let pending;
    do {
      pending = this.queue;
      await pending;
    } while (pending !== this.queue);
  }
  async accountForGuard(guard: string) {
    const session = getCompanionChallengeSession();
    if (session.blocked || this.clearing) return null;
    const saved = await this.load();
    const binding = saved.binding;
    const config = await this.deps.config();
    if (
      getCompanionChallengeSession() !== session ||
      this.clearing ||
      !binding?.enabled ||
      binding.guard !== guard ||
      binding.expires <= this.deps.now() ||
      config?.id !== binding.configId ||
      (await this.deps.permission()) !== 'granted' ||
      getCompanionChallengeSession() !== session
    )
      return null;
    return binding.account;
  }
  private async load() {
    if (!this.saved) {
      const stored = await this.deps.read();
      try {
        this.saved = schema.parse(JSON.parse(stored ?? 'null'));
      } catch {
        this.saved = {
          installation: this.deps.uuid(),
          revision: 0,
          binding: null,
        };
      }
    }
    return this.saved;
  }
  private async persist() {
    await this.deps.write(JSON.stringify(this.saved));
  }
  clear() {
    ++this.epoch;
    this.clearing = true;
    this.update(null); // Synchronous tap/fallback guard, before any await.
    this.queue = this.queue
      .then(async () => {
        const saved = await this.load();
        const binding = saved.binding;
        if (!binding) return;
        binding.enabled = false;
        ++saved.revision;
        await this.persist();
        const config = this.lastConfig ?? (await this.deps.config());
        if (config?.id === binding.configId) {
          await this.deps.unregister(config, {
            installation_id: saved.installation,
            account_guard: binding.guard,
            revision: saved.revision,
          });
        }
      })
      .catch((error: unknown) =>
        this.deps.warn('cleanup', registrationFailureCode(error))
      );
    return this.queue;
  }
  reconcile(
    input: PushEligibility,
    devicePushToken?: Notifications.DevicePushToken
  ) {
    const epoch = this.epoch;
    const session = getCompanionChallengeSession();
    const valid = () =>
      epoch === this.epoch &&
      getCompanionChallengeSession() === session &&
      !session.blocked &&
      session.revision === input.revision;
    if (!input.enabled || !input.account || !this.deps.supported())
      return this.clear();
    let stage: RegistrationStage = 'permission';
    this.queue = this.queue
      .then(async () => {
        if (!valid()) return;
        const permission = await this.deps.permission();
        if (!valid()) return;
        if (permission !== 'granted') {
          void this.clear();
          return;
        }
        stage = 'configuration';
        const config = await this.deps.config();
        if (!valid() || !config || config.id !== input.configId) return;
        stage = 'secure-read';
        const saved = await this.load();
        if (!valid()) return;
        this.lastConfig = config;
        stage = 'token';
        const token = await withTimeout(
          this.deps.token(devicePushToken),
          10_000,
          'Push token acquisition'
        );
        if (!valid()) return;
        const previous = saved.binding;
        const same =
          previous?.account === input.account &&
          previous.configId === config.id &&
          previous.token === token &&
          previous.enabled;
        // Refresh the lease daily on foreground/cache events; no polling loop.
        if (same && previous.expires > this.deps.now() + 6 * 86400_000) {
          this.update({
            account: input.account,
            guard: previous.guard,
            expires: previous.expires,
          });
          return;
        }
        const binding = {
          account: input.account,
          configId: config.id,
          token,
          guard: same ? previous.guard : this.deps.uuid(),
          enabled: true,
          expires: same ? previous.expires : 0,
        };
        saved.binding = binding;
        ++saved.revision;
        stage = 'secure-write';
        await this.persist(); // Persist revision before issuing any request.
        if (!valid()) return;
        stage = 'register';
        const response = await this.deps.register(config, {
          installation_id: saved.installation,
          platform: this.deps.platform(),
          expo_push_token: token,
          account_guard: binding.guard,
          revision: saved.revision,
        });
        if (!valid()) return; // clear() queued behind this will revoke its binding.
        binding.enabled = !!response?.enabled;
        binding.expires = response?.expires_at
          ? Date.parse(response.expires_at)
          : 0;
        stage = 'secure-write';
        await this.persist();
        if (!valid()) return;
        this.update(
          binding.enabled
            ? {
                account: binding.account,
                guard: binding.guard,
                expires: binding.expires,
              }
            : null
        );
      })
      .catch((error: unknown) => {
        // A transient refresh failure does not invalidate an acknowledged,
        // unexpired lease. Retaining it prevents duplicate local invitation alerts.
        const binding = this.saved?.binding;
        this.update(
          valid() &&
            binding?.enabled &&
            binding.account === input.account &&
            binding.expires > this.deps.now()
            ? {
                account: binding.account,
                guard: binding.guard,
                expires: binding.expires,
              }
            : null
        );
        this.deps.warn(stage, registrationFailureCode(error));
      });
    return this.queue;
  }
}

export const remotePushRegistration = new RemotePushRegistration({
  read: () => SecureStore.getItemAsync(KEY),
  write: (value) =>
    SecureStore.setItemAsync(KEY, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
  uuid: Crypto.randomUUID,
  config: getActiveServerConfig,
  permission: getNotificationPermissionStatus,
  supported: () =>
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    Constants.expoConfig?.extra?.remotePushEnabled === true,
  platform: () => (Platform.OS === 'ios' ? 'ios' : 'android'),
  token: async (devicePushToken) => {
    const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
    if (projectId !== '63f08cec-3f87-4cee-89be-bebf970b6262')
      throw new Error('Owned push project required');
    // Android requires a channel before obtaining a native push token.
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('challenges', {
        name: translation.t('challenges.title', { defaultValue: 'Challenges' }),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    await Notifications.setNotificationCategoryAsync('challenge', []);
    // iOS emits its token callback when getDevicePushTokenAsync registers with
    // APNs, including our own acquisition. Reuse the callback's native token so
    // reconciling that event does not start another native registration cycle.
    return (
      await Notifications.getExpoPushTokenAsync({
        projectId,
        ...(devicePushToken ? { devicePushToken } : {}),
      })
    ).data;
  },
  register: registerRemotePush,
  unregister: unregisterRemotePush,
  now: Date.now,
  warn: (stage, code) => {
    void addLog(
      `Remote invitation registration unavailable (${stage}: ${code}); local fallback retained.`,
      'WARNING'
    );
  },
});
setRemotePushIdentityCleanup(() => remotePushRegistration.clear());
setRemotePushAccountResolver(async (guard) =>
  remoteInvitationsEligible()
    ? remotePushRegistration.accountForGuard(guard)
    : null
);
subscribeCompanionChallengeSession(() => {
  void remotePushRegistration.clear();
});
export function remoteInvitationsEligible() {
  const p = useAppPreferencesStore.getState();
  return (
    p.notificationsEnabled &&
    p.challengeNotifications.enabled &&
    p.challengeNotifications.invitations
  );
}
