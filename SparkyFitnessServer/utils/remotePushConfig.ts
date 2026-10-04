/** Fixed Expo service, server-side secret only. Called after generic *_FILE loading. */
export function remotePushConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = env.SPARKY_FITNESS_REMOTE_PUSH_ENABLED ?? 'false';
  if (!['true', 'false'].includes(value))
    throw new Error('SPARKY_FITNESS_REMOTE_PUSH_ENABLED must be true or false');
  if (value === 'false') return { enabled: false as const };
  const accessToken = env.EXPO_ACCESS_TOKEN?.trim();
  if (
    !accessToken ||
    /\s/.test(accessToken) ||
    /^(changeme|replace_with)/i.test(accessToken)
  )
    throw new Error(
      'Remote push requires EXPO_ACCESS_TOKEN or EXPO_ACCESS_TOKEN_FILE'
    );
  return { enabled: true as const, accessToken };
}
