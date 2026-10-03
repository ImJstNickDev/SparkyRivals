import { describe, expect, it } from 'vitest';
import { formatChallengeDuration } from '@workspace/shared';
describe('duration formatting preserves score precision', () => {
  it.each([
    [0, '0m'],
    [47 * 60, '47m'],
    [7500, '2h 5m'],
    [3601, '1h 1s'],
    [59, '59s'],
  ] as const)('%i seconds', (value, expected) =>
    expect(formatChallengeDuration(value, 'en')).toBe(expected)
  );
  it('uses the requested locale', () =>
    expect(formatChallengeDuration(7500, 'it')).toMatch(/2.*h.*5.*min/));
});
