import type { ChallengeScoreUnit } from "../types.ts";
import {
  challengeDisplayQuantity,
  type ChallengeDisplayPreferences,
  type ChallengeDisplayUnit,
} from "../format.ts";
import type { ChallengeTranslator } from "./translator.ts";

export function challengeDisplayUnitText(
  t: ChallengeTranslator,
  unit: ChallengeDisplayUnit,
  count = 2,
): string {
  switch (unit) {
    case "steps":
      return t("challenges.valueUnits.steps", {
        count,
        defaultValue_one: "step",
        defaultValue: "steps",
      });
    case "points":
      return t("challenges.valueUnits.points", {
        count,
        defaultValue_one: "point",
        defaultValue: "points",
      });
    case "goal_days":
      return t("challenges.valueUnits.goalDays", {
        count,
        defaultValue_one: "goal day",
        defaultValue: "goal days",
      });
    case "km":
      return t("challenges.valueUnits.km", { defaultValue: "km" });
    case "mi":
      return t("challenges.valueUnits.mi", { defaultValue: "mi" });
    case "kcal":
      return t("challenges.valueUnits.kcal", { defaultValue: "kcal" });
    case "kJ":
      return t("challenges.valueUnits.kj", { defaultValue: "kJ" });
    case "ml":
      return t("challenges.valueUnits.ml", { defaultValue: "ml" });
    case "L":
      return t("challenges.valueUnits.liter", { defaultValue: "L" });
    case "fl_oz":
      return t("challenges.valueUnits.fluidOunce", { defaultValue: "fl oz" });
    case "seconds":
      return t("challenges.valueUnits.seconds", { defaultValue: "s" });
    case "minutes":
      return t("challenges.valueUnits.minutes", { defaultValue: "min" });
    case "hours":
      return t("challenges.valueUnits.hours", { defaultValue: "h" });
  }
}

/** Localized presentation only, including tiny nonzero values. Exact server
 * values and ranks stay intact; no client sorting or scoring happens here. */
export function formatChallengeDisplay(
  value: number,
  unit: ChallengeScoreUnit,
  locale: string,
  t: ChallengeTranslator,
  preferences: ChallengeDisplayPreferences = {},
  withUnit = true,
  maximumFractionDigits?: number,
): string {
  const display = challengeDisplayQuantity(value, unit, preferences);
  const decimals = maximumFractionDigits ?? display.decimals;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: decimals,
  });
  const minimum = 10 ** -decimals;
  const formatted =
    display.value > 0 && display.value < minimum
      ? t("challenges.lessThanValue", {
          defaultValue: "<{{value}}",
          value: number.format(minimum),
        })
      : number.format(display.value);
  return withUnit
    ? t("challenges.valueWithUnit", {
        defaultValue: "{{value}} {{unit}}",
        value: formatted,
        unit: challengeDisplayUnitText(t, display.unit, display.value),
      })
    : formatted;
}
