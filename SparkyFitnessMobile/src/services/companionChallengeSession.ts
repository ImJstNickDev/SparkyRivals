/** Synchronous privacy barrier, independent of network/React render timing.
 * Auth owns invalidation; each platform publisher owns its native writes. */
let current = { revision: 0, blocked: false };
const listeners = new Set<() => void>();
export const getCompanionChallengeSession = () => current;
export function subscribeCompanionChallengeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateCompanionChallengeSession(blocked: boolean) {
  current = { revision: current.revision + 1, blocked };
  for (const listener of listeners) listener();
}
