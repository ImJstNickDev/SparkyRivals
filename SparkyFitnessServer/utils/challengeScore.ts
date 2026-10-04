import {
  CHALLENGE_POINT_SCALE,
  type ChallengeScoringMode,
} from '@workspace/shared';

const SCALE = BigInt(CHALLENGE_POINT_SCALE);
/** SQL numeric values cross this boundary as decimal strings, never float ratios. */
export function challengeDecimal(value: string | number): bigint {
  const text = typeof value === 'number' ? value.toFixed(6) : value;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error('Invalid canonical Challenge decimal');
  const fraction = (match[3] ?? '').padEnd(7, '0');
  const absolute =
    BigInt(match[2]!) * SCALE +
    BigInt(fraction.slice(0, 6)) +
    (Number(fraction[6]) >= 5 ? 1n : 0n);
  return match[1] ? -absolute : absolute;
}
export function scoreChallengeDay(
  actual: bigint,
  target: bigint | null,
  mode: ChallengeScoringMode,
  present: boolean
): bigint {
  if (!present) return 0n;
  if (mode === 'sum') return actual;
  if (target === null || target <= 0n)
    throw new Error('Locked Challenge target missing');
  if (mode === 'goal_days') return actual >= target ? SCALE : 0n;
  // Round half up to a millionth of a point. No cap and no raw-value tie-break.
  return (actual * 100n * SCALE + target / 2n) / target;
}
export function challengeScoreNumber(value: bigint): number {
  return Number(value) / CHALLENGE_POINT_SCALE;
}
