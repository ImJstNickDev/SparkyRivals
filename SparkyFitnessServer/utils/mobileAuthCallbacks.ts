const UPSTREAM_SCHEME = 'sparkyfitnessmobile';
const RESERVED_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'data',
  'file',
  'content',
  'intent',
  'mailto',
  'tel',
  'exp',
  'exps',
]);

/** Server-owned native destinations. Never accept a client-supplied return URL. */
function configuredSchemes(): string[] {
  const raw = process.env.SPARKY_FITNESS_MOBILE_AUTH_SCHEMES;
  const extra = raw?.trim() ? raw.split(',').map((value) => value.trim()) : [];
  for (const scheme of extra) {
    if (
      !/^[a-z][a-z0-9+.-]{1,62}$/.test(scheme) ||
      RESERVED_SCHEMES.has(scheme)
    ) {
      throw new Error(
        'SPARKY_FITNESS_MOBILE_AUTH_SCHEMES must contain only dedicated native schemes'
      );
    }
  }
  return [...new Set([UPSTREAM_SCHEME, ...extra])];
}

export function getMobileAuthOrigins(): string[] {
  return configuredSchemes().map((scheme) => `${scheme}://`);
}

export function resolveMobileAuthCallback(requestedScheme: unknown): {
  url: string;
  bridgePath: string;
} | null {
  const schemes = configuredSchemes();
  const scheme =
    requestedScheme === undefined ? UPSTREAM_SCHEME : requestedScheme;
  if (typeof scheme !== 'string' || !schemes.includes(scheme)) return null;
  return {
    url: `${scheme}://oauth-callback`,
    bridgePath:
      '/api/auth/web-login/callback' +
      (scheme === UPSTREAM_SCHEME
        ? ''
        : `?app_scheme=${encodeURIComponent(scheme)}`),
  };
}
