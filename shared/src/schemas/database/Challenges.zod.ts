import { z } from "zod";
import { isDayString, isValidTimeZone } from "../../utils/timezone.ts";

export const challengeDaySchema = z
  .string()
  .refine(isDayString, "Invalid calendar date");
export const challengeTimezoneSchema = z
  .string()
  .max(100)
  .refine(
    (zone) =>
      (zone === "UTC" || zone.includes("/")) &&
      !zone.startsWith("posix/") &&
      !zone.startsWith("right/") &&
      isValidTimeZone(zone),
    "Invalid IANA timezone",
  );
export const challengeNameSchema = z.string().trim().min(1).max(100);
export const challengeMetricSchema = z.enum([
  "steps",
  "distance",
  "active_calories",
  "workout_time",
  "workout_calories",
  "workout_distance",
  "hydration",
]);
export const challengeScoringModeSchema = z.enum([
  "sum",
  "goal_progress",
  "goal_days",
]);
export const challengesSchema = z.object({
  id: z.uuid(),
  creator_user_id: z.uuid(),
  name: challengeNameSchema,
  metric: challengeMetricSchema,
  scoring_mode: challengeScoringModeSchema,
  start_date: challengeDaySchema.nullable(),
  end_date: challengeDaySchema.nullable(),
  timezone: challengeTimezoneSchema,
  duration_days: z.number().int().min(1).max(366).optional(),
  start_next_day: z.boolean().optional(),
  locked_at: z.date().nullable().optional(),
  cancelled_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type Challenge = z.infer<typeof challengesSchema>;
