import { describe, expect, it } from 'vitest';
import { assertChallengeTestDatabase } from './helpers/challengeTestDatabase.js';
const valid = {
  RUN_CHALLENGE_DB_TESTS: '1',
  SPARKY_FITNESS_DB_NAME: 'sparkyrivals_test',
  SPARKY_FITNESS_DB_HOST: '127.0.0.1',
};
describe('destructive Challenge fixture guard', () => {
  it('accepts only explicit local disposable test configuration', () =>
    expect(() => assertChallengeTestDatabase(valid)).not.toThrow());
  it.each([
    { RUN_CHALLENGE_DB_TESTS: undefined },
    { SPARKY_FITNESS_DB_NAME: 'production' },
    { SPARKY_FITNESS_DB_NAME: 'contest' },
    { SPARKY_FITNESS_DB_HOST: 'production.example.com' },
    { SPARKY_FITNESS_DB_HOST: undefined },
  ])('rejects unsafe fixture settings %j', (change) =>
    expect(() => assertChallengeTestDatabase({ ...valid, ...change })).toThrow(
      'local disposable test database'
    )
  );
});
