import type { ChallengeDailyScore } from "../../schemas/api/Challenges.api.zod.ts";

export function challengeDayState(point: ChallengeDailyScore | undefined) {
  if (!point?.eligible) return "future";
  if (!point.present) return "missing";
  if (point.goal_reached === true) return "reached";
  if (point.goal_reached === false) return "notReached";
  return "present";
}

/** Compare exact daily scores for presentation, without recalculating any rank. */
export function challengeDayComparison(
  a?: ChallengeDailyScore,
  b?: ChallengeDailyScore,
) {
  if (!a?.eligible || !b?.eligible || !a.present || !b.present) return null;
  const av = a.score_scaled === undefined ? a.value : BigInt(a.score_scaled);
  const bv = b.score_scaled === undefined ? b.value : BigInt(b.score_scaled);
  // Mixed-version points cannot be compared at different scales.
  if (typeof av !== typeof bv) return null;
  return av === bv ? "tie" : av > bv ? "first" : "second";
}
