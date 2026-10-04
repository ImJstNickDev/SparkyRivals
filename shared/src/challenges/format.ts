import { formatChallengeDuration } from "./duration.ts";
import {
  CHALLENGE_TYPES,
  CHALLENGE_METRIC_UNITS,
  type ChallengeMetric,
  type ChallengeScoringMode,
  type ChallengeScoreUnit,
} from "./types.ts";

/** Client presentation only. Input is always the canonical server unit. */
export function formatChallengeValue(
  value: number,
  unit: ChallengeScoreUnit,
  locale = "en",
  withUnit = true,
): string {
  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(n);
  switch (unit) {
    case "seconds":
      return formatChallengeDuration(value, locale);
    case "meters":
      return `${number(value / 1000)} km`;
    case "milliliters":
      return `${number(value)} ml`;
    case "kcal":
      return `${number(value)} kcal`;
    case "points":
      return `${number(value)} pts`;
    case "goal_days":
      return `${number(value)} goal days`;
    case "steps":
      return withUnit ? `${number(value)} steps` : number(value);
  }
}
export function challengeTypeLabel(
  metric: ChallengeMetric,
  mode: ChallengeScoringMode,
): string {
  return (
    CHALLENGE_TYPES.find(
      (type) => type.metric === metric && type.scoring_mode === mode,
    )?.label ?? "Challenge"
  );
}
/** Editable targets use minutes/km; conversion back to canonical units is explicit. */
export function challengeTargetInput(metric: ChallengeMetric) {
  return metric === "workout_time"
    ? { unit: "minutes", factor: 60 }
    : metric === "distance" || metric === "workout_distance"
      ? { unit: "km", factor: 1000 }
      : { unit: CHALLENGE_METRIC_UNITS[metric], factor: 1 };
}
