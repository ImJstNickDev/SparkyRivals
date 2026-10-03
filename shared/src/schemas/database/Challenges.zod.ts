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
export const challengeMetricSchema = z.enum(["steps", "workout_time"]);
export const challengeScoringModeSchema = z.enum(["sum"]);
export const challengesSchema = z.object({
  id: z.uuid(),
  creator_user_id: z.uuid(),
  name: challengeNameSchema,
  metric: challengeMetricSchema,
  scoring_mode: challengeScoringModeSchema,
  start_date: challengeDaySchema,
  end_date: challengeDaySchema,
  timezone: challengeTimezoneSchema,
  cancelled_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type Challenge = z.infer<typeof challengesSchema>;
