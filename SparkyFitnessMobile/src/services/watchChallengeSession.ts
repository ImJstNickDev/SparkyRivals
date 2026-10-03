/** Synchronous privacy barrier, independent of network/React render timing.
 * Auth owns invalidation; the existing context composer owns all native writes. */
let current = { revision: 0, blocked: false };
const listeners = new Set<() => void>();
export const getWatchChallengeSession = () => current;
export function subscribeWatchChallengeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateWatchChallengeSession(blocked: boolean) {
  current = { revision: current.revision + 1, blocked };
  for (const listener of listeners) listener();
}
