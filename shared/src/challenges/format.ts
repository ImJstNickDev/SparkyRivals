import { formatChallengeDuration } from "./duration.ts";
import {
  CHALLENGE_TYPES,
  type ChallengeMetric,
  type ChallengeScoringMode,
  type ChallengeScoreUnit,
} from "./types.ts";

export interface ChallengeDisplayPreferences {
  distance?: "km" | "miles";
  energy?: "kcal" | "kJ";
  water?: "ml" | "oz" | "liter";
}
export type ChallengeDisplayUnit =
  | "steps"
  | "points"
  | "goal_days"
  | "km"
  | "mi"
  | "kcal"
  | "kJ"
  | "ml"
  | "L"
  | "fl_oz"
  | "seconds"
  | "minutes"
  | "hours";

/** Presentation only: callers supply their existing locale/translation system.
 * This never changes canonical values, fixed-point scores or server ranks. */
export function challengeDisplayQuantity(
  value: number,
  unit: ChallengeScoreUnit,
  preferences: ChallengeDisplayPreferences = {},
): { value: number; unit: ChallengeDisplayUnit; decimals: number } {
  switch (unit) {
    case "steps":
      return { value, unit, decimals: 0 };
    case "goal_days":
      return { value, unit, decimals: 0 };
    case "points":
      return { value, unit, decimals: 2 };
    case "meters":
      return {
        value: value / (preferences.distance === "miles" ? 1609.34 : 1000),
        unit: preferences.distance === "miles" ? "mi" : "km",
        decimals: 2,
      };
    case "kcal":
      return {
        value: value * (preferences.energy === "kJ" ? 4.184 : 1),
        unit: preferences.energy ?? "kcal",
        decimals: 1,
      };
    case "milliliters":
      return preferences.water === "liter"
        ? { value: value / 1000, unit: "L", decimals: 2 }
        : preferences.water === "oz"
          ? { value: value / 29.5735, unit: "fl_oz", decimals: 1 }
          : { value, unit: "ml", decimals: 0 };
    case "seconds":
      return value >= 3600
        ? { value: value / 3600, unit: "hours", decimals: 2 }
        : value >= 60 || value === 0
          ? { value: value / 60, unit: "minutes", decimals: 1 }
          : { value, unit: "seconds", decimals: 0 };
  }
}

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
      return withUnit
        ? formatChallengeDuration(value, locale)
        : number(value / 60);
    case "meters":
      return withUnit ? `${number(value / 1000)} km` : number(value / 1000);
    case "milliliters":
      return withUnit ? `${number(value)} ml` : number(value);
    case "kcal":
      return withUnit ? `${number(value)} kcal` : number(value);
    case "points":
      return withUnit ? `${number(value)} pts` : number(value);
    case "goal_days":
      return withUnit ? `${number(value)} goal days` : number(value);
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
export function challengeTargetInput(
  metric: ChallengeMetric,
  preferences: ChallengeDisplayPreferences = {},
): { unit: ChallengeDisplayUnit; factor: number } {
  return metric === "workout_time"
    ? { unit: "minutes", factor: 60 }
    : metric === "distance" || metric === "workout_distance"
      ? {
          unit: preferences.distance === "miles" ? "mi" : "km",
          factor: preferences.distance === "miles" ? 1609.34 : 1000,
        }
      : metric === "hydration"
        ? preferences.water === "liter"
          ? { unit: "L", factor: 1000 }
          : preferences.water === "oz"
            ? { unit: "fl_oz", factor: 29.5735 }
            : { unit: "ml", factor: 1 }
        : metric === "active_calories" || metric === "workout_calories"
          ? preferences.energy === "kJ"
            ? { unit: "kJ", factor: 1 / 4.184 }
            : { unit: "kcal", factor: 1 }
          : { unit: "steps", factor: 1 };
}
