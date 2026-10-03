/** Destructive fixtures are opt-in and restricted to an explicitly named local test DB. */
export function assertChallengeTestDatabase(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (
    env.RUN_CHALLENGE_DB_TESTS !== '1' ||
    !/(^|[_-])test([_-]|$)/i.test(env.SPARKY_FITNESS_DB_NAME ?? '') ||
    !['localhost', '127.0.0.1', '::1'].includes(
      env.SPARKY_FITNESS_DB_HOST ?? ''
    )
  ) {
    throw new Error(
      'Challenge integration fixtures require RUN_CHALLENGE_DB_TESTS=1 and a local disposable test database'
    );
  }
}
