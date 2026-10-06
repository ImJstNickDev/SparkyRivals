import { z } from "zod";
import type { Challenge } from "../schemas/database/Challenges.zod.ts";

export type ChallengeMetric = Challenge["metric"];
export type ChallengeScoringMode = Challenge["scoring_mode"];
export const challengeCanonicalUnitSchema = z.enum([
  "steps",
  "meters",
  "kcal",
  "seconds",
  "milliliters",
]);
export const challengeScoreUnitSchema = z.enum([
  "steps",
  "meters",
  "kcal",
  "seconds",
  "milliliters",
  "points",
  "goal_days",
]);
export type ChallengeScoreUnit = z.infer<typeof challengeScoreUnitSchema>;
export const CHALLENGE_METRIC_UNITS = {
  steps: "steps",
  distance: "meters",
  active_calories: "kcal",
  workout_time: "seconds",
  workout_calories: "kcal",
  workout_distance: "meters",
  hydration: "milliliters",
} as const satisfies Record<
  ChallengeMetric,
  z.infer<typeof challengeCanonicalUnitSchema>
>;
export function isChallengeCombinationAllowed(
  metric: ChallengeMetric,
  scoring: ChallengeScoringMode,
): boolean {
  return metric === "hydration"
    ? scoring !== "sum"
    : metric === "workout_distance"
      ? scoring === "sum"
      : true;
}
export function challengeScoreUnit(
  metric: ChallengeMetric,
  scoring: ChallengeScoringMode,
): ChallengeScoreUnit {
  return scoring === "goal_progress"
    ? "points"
    : scoring === "goal_days"
      ? "goal_days"
      : CHALLENGE_METRIC_UNITS[metric];
}
/** Configuration precision only: no fairness minimum or performance cap. */
export const challengeTargetSchema = z
  .number()
  .min(0.000001)
  .max(1_000_000_000)
  .refine(
    (value) =>
      Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) < 0.0001,
    "Use at most six decimal places",
  );
export const CHALLENGE_POINT_SCALE = 1_000_000;
export const CHALLENGE_TYPES = [
  {
    id: "step-race",
    metric: "steps",
    scoring_mode: "sum",
    label: "Step Race",
    group: "movement",
  },
  {
    id: "step-goal",
    metric: "steps",
    scoring_mode: "goal_progress",
    label: "Step Goal",
    group: "movement",
  },
  {
    id: "step-streak",
    metric: "steps",
    scoring_mode: "goal_days",
    label: "Step Goal Days",
    group: "movement",
  },
  {
    id: "distance-race",
    metric: "distance",
    scoring_mode: "sum",
    label: "Distance Race",
    group: "movement",
  },
  {
    id: "distance-goal",
    metric: "distance",
    scoring_mode: "goal_progress",
    label: "Distance Goal",
    group: "movement",
  },
  {
    id: "distance-streak",
    metric: "distance",
    scoring_mode: "goal_days",
    label: "Distance Goal Days",
    group: "movement",
  },
  {
    id: "active-calories",
    metric: "active_calories",
    scoring_mode: "sum",
    label: "Active Calories",
    group: "movement",
  },
  {
    id: "move-goal",
    metric: "active_calories",
    scoring_mode: "goal_progress",
    label: "Move Goal",
    group: "movement",
  },
  {
    id: "move-streak",
    metric: "active_calories",
    scoring_mode: "goal_days",
    label: "Move Goal Days",
    group: "movement",
  },
  {
    id: "workout-minutes",
    metric: "workout_time",
    scoring_mode: "sum",
    label: "Workout Minutes",
    group: "workout",
  },
  {
    id: "workout-minutes-goal",
    metric: "workout_time",
    scoring_mode: "goal_progress",
    label: "Workout Minutes Goal",
    group: "workout",
  },
  {
    id: "workout-minutes-streak",
    metric: "workout_time",
    scoring_mode: "goal_days",
    label: "Workout Minute Goal Days",
    group: "workout",
  },
  {
    id: "workout-calories",
    metric: "workout_calories",
    scoring_mode: "sum",
    label: "Workout Calories",
    group: "workout",
  },
  {
    id: "workout-calorie-goal",
    metric: "workout_calories",
    scoring_mode: "goal_progress",
    label: "Workout Calorie Goal",
    group: "workout",
  },
  {
    id: "workout-calorie-streak",
    metric: "workout_calories",
    scoring_mode: "goal_days",
    label: "Workout Calorie Goal Days",
    group: "workout",
  },
  {
    id: "workout-distance",
    metric: "workout_distance",
    scoring_mode: "sum",
    label: "Workout Distance",
    group: "workout",
  },
  {
    id: "hydration-goal",
    metric: "hydration",
    scoring_mode: "goal_progress",
    label: "Hydration Goal",
    group: "hydration",
  },
  {
    id: "hydration-streak",
    metric: "hydration",
    scoring_mode: "goal_days",
    label: "Hydration Goal Days",
    group: "hydration",
  },
] as const satisfies readonly {
  id: string;
  metric: ChallengeMetric;
  scoring_mode: ChallengeScoringMode;
  label: string;
  group: string;
}[];

export interface ChallengePersonalGoals {
  steps_goal?: number | null;
  distance_goal_meters?: number | null;
  active_calories_goal?: number | null;
  target_exercise_duration_minutes?: number | null;
  target_exercise_calories_burned?: number | null;
  water_goal_ml?: number | null;
}
export function suggestedChallengeTarget(
  metric: ChallengeMetric,
  goals: ChallengePersonalGoals,
): number | null {
  const value =
    metric === "steps"
      ? goals.steps_goal
      : metric === "distance"
        ? goals.distance_goal_meters
        : metric === "active_calories"
          ? goals.active_calories_goal
          : metric === "workout_time"
            ? goals.target_exercise_duration_minutes == null
              ? null
              : goals.target_exercise_duration_minutes * 60
            : metric === "workout_calories"
              ? goals.target_exercise_calories_burned
              : metric === "hydration"
                ? goals.water_goal_ml
                : null;
  const numeric = value == null ? null : Number(value);
  return challengeTargetSchema.safeParse(numeric).success ? numeric : null;
}
