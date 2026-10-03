import { z } from 'zod';
import { getAppUrl } from './appLinks';
/** Include a noncredential guard so old OS surfaces cannot target another account. */
export function getChallengeSurfaceUrl(id: string, accountKey: string) {
  return getAppUrl(
    `challenges/${encodeURIComponent(id)}?account=${encodeURIComponent(accountKey)}`
  );
}
export function isChallengeSurfaceLinkAllowed(
  url: string,
  accountKey: string
): boolean {
  try {
    const parsed = new URL(url);
    const current = new URL(getAppUrl());
    if (parsed.protocol !== current.protocol) return false;
    if (parsed.hostname !== 'challenges') return true;
    const id = parsed.pathname.slice(1);
    if (!id || id === 'new') return true;
    return (
      z.uuid().safeParse(id).success &&
      (!parsed.searchParams.has('account') ||
        parsed.searchParams.get('account') === accountKey)
    );
  } catch {
    return false;
  }
}
