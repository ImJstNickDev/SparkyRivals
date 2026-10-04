// Dependency-free hook called before discarding/switching stored credentials.
let prepare: (() => Promise<void>) | undefined;
export const setRemotePushIdentityCleanup = (callback: () => Promise<void>) => {
  prepare = callback;
};
export async function prepareRemotePushIdentityChange() {
  await prepare?.();
}

// Notifications cannot import registration directly: it uses permission helpers
// from notifications. Resolve through a fail-closed boundary to avoid that cycle.
let resolveAccount: ((guard: string) => Promise<string | null>) | undefined;
export function setRemotePushAccountResolver(
  resolver: (guard: string) => Promise<string | null>
) {
  resolveAccount = resolver;
}
export async function resolveRemotePushAccount(guard: string) {
  try {
    return (await resolveAccount?.(guard)) ?? null;
  } catch {
    return null;
  }
}
