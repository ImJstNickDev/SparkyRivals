import { describe, expect, it } from 'vitest';
import {
  challengeDaySchema,
  challengeTimezoneSchema,
  challengeNameSchema,
  challengeMetricSchema,
  challengeScoringModeSchema,
} from '@workspace/shared';

describe('challenge scalar contracts', () => {
  it.each(['UTC', 'Europe/Rome', 'America/New_York'])(
    'accepts zone %s',
    (zone) => {
      expect(challengeTimezoneSchema.parse(zone)).toBe(zone);
    }
  );
  it.each(['', 'Mars/Olympus', '+02:00', 'posix/Europe/Rome'])(
    'rejects zone %s',
    (zone) => {
      expect(challengeTimezoneSchema.safeParse(zone).success).toBe(false);
    }
  );
  it.each(['2026-03-29', '2026-10-25', '2024-02-29'])(
    'preserves date %s',
    (day) => {
      expect(challengeDaySchema.parse(day)).toBe(day);
    }
  );
  it.each(['2026-02-29', '2026-01-01T00:00:00Z', '2026-13-01'])(
    'rejects invalid date %s',
    (day) => {
      expect(challengeDaySchema.safeParse(day).success).toBe(false);
    }
  );
  it('trims names and rejects blank/long names and unsupported strategies', () => {
    expect(challengeNameSchema.parse(' Steps ')).toBe('Steps');
    expect(challengeNameSchema.safeParse('  ').success).toBe(false);
    expect(challengeNameSchema.safeParse('x'.repeat(101)).success).toBe(false);
    expect(challengeMetricSchema.safeParse('calories').success).toBe(false);
    expect(challengeScoringModeSchema.safeParse('max').success).toBe(false);
  });
});
