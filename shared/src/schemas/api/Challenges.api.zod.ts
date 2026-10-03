import { z } from "zod";
import { daysBetween, isDayString } from "../../utils/timezone.ts";
import {
  challengesSchema,
  challengeNameSchema,
  challengeDaySchema,
  challengeTimezoneSchema,
  challengeMetricSchema,
  challengeScoringModeSchema,
} from "../database/Challenges.zod.ts";
import {
  challengeParticipantsSchema,
  challengeMembershipStatusSchema,
} from "../database/ChallengeParticipants.zod.ts";

export const CHALLENGE_MAX_DAYS = 366;
export const CHALLENGE_MAX_PARTICIPANTS = 100;
export const createChallengeRequestSchema = z
  .object({
    name: challengeNameSchema,
    metric: challengeMetricSchema.default("steps"),
    scoring_mode: challengeScoringModeSchema.default("sum"),
    start_date: challengeDaySchema,
    end_date: challengeDaySchema,
    timezone: challengeTimezoneSchema,
    participant_ids: z
      .array(z.uuid())
      .max(CHALLENGE_MAX_PARTICIPANTS - 1)
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (isDayString(value.start_date) && isDayString(value.end_date)) {
      const duration = daysBetween(value.start_date, value.end_date) + 1;
      if (duration < 1 || duration > CHALLENGE_MAX_DAYS)
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: "Challenge must span 1–366 inclusive calendar days",
        });
    }
    if (new Set(value.participant_ids).size !== value.participant_ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["participant_ids"],
        message: "Duplicate participant",
      });
  });
export type CreateChallengeRequest = z.infer<
  typeof createChallengeRequestSchema
>;
export const inviteChallengeRequestSchema = z
  .object({ user_id: z.uuid() })
  .strict();
export const renameChallengeRequestSchema = z
  .object({ name: challengeNameSchema })
  .strict();
export const challengeIdParamsSchema = z.object({ id: z.uuid() }).strict();
export const challengeListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .strict();
export type ChallengeListQuery = z.infer<typeof challengeListQuerySchema>;
export const challengeLifecycleSchema = z.enum([
  "upcoming",
  "active",
  "completed",
  "cancelled",
]);
export type ChallengeLifecycle = z.infer<typeof challengeLifecycleSchema>;
export const challengeResponseSchema = challengesSchema.extend({
  cancelled_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  lifecycle: challengeLifecycleSchema,
  my_membership: challengeMembershipStatusSchema,
  progress: z.object({
    today: challengeDaySchema,
    total_days: z.number().int().positive(),
    elapsed_days: z.number().int().nonnegative(),
    days_remaining: z.number().int().nonnegative(),
    current_day: z.number().int().positive().nullable(),
  }),
});
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;
export const challengeParticipantResponseSchema =
  challengeParticipantsSchema.extend({
    display_name: z.string(),
    invited_at: z.iso.datetime(),
    accepted_at: z.iso.datetime().nullable(),
    declined_at: z.iso.datetime().nullable(),
    left_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  });
export type ChallengeParticipantResponse = z.infer<
  typeof challengeParticipantResponseSchema
>;
export const challengeDetailResponseSchema = z.object({
  challenge: challengeResponseSchema,
  participants: z.array(challengeParticipantResponseSchema),
});
export type ChallengeDetailResponse = z.infer<
  typeof challengeDetailResponseSchema
>;
export const challengeListResponseSchema = z.object({
  challenges: z.array(challengeResponseSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
});
export type ChallengeListResponse = z.infer<typeof challengeListResponseSchema>;

export const challengeDailyScoreSchema = z.object({
  date: challengeDaySchema,
  value: z.number().int(),
  /** True for a canonical metric point, including a qualifying explicit zero. */
  present: z.boolean(),
  workout_count: z.number().int().nonnegative().optional(),
  /** Future days have not become eligible; their canonical rows are not read. */
  eligible: z.boolean(),
});
export type ChallengeDailyScore = z.infer<typeof challengeDailyScoreSchema>;
export const challengeLeaderboardEntrySchema = z.object({
  user_id: z.uuid(),
  display_name: z.string(),
  membership_status: z.literal("accepted"),
  total_score: z.number().int(),
  total_workout_count: z.number().int().nonnegative().optional(),
  /** Competition ranking: equal scores share a rank; subsequent ranks skip. */
  rank: z.number().int().positive().nullable(),
  is_tied: z.boolean(),
  gap_to_leader: z.number().int().nonnegative().nullable(),
  gap_to_next_rank: z.number().int().nonnegative().nullable(),
  daily: z.array(challengeDailyScoreSchema),
  today: challengeDailyScoreSchema.nullable(),
  coverage: z.object({
    /** Legacy v1 steps alias, absent for workout time. */
    days_with_steps: z.number().int().nonnegative().optional(),
    days_with_data: z.number().int().nonnegative().optional(),
    eligible_days: z.number().int().nonnegative(),
    latest_data_update_at: z.iso.datetime().nullable(),
  }),
});
export type ChallengeLeaderboardEntry = z.infer<
  typeof challengeLeaderboardEntrySchema
>;
export const challengeLeaderboardResponseSchema = z
  .object({
    contract_version: z.union([z.literal(1), z.literal(2)]),
    score_unit: z.enum(["steps", "seconds"]).optional(),
    challenge: challengeResponseSchema,
    calculated_at: z.iso.datetime(),
    /** Completed results still change when canonical data is corrected. */
    reconciles: z.literal(true),
    scored_through: challengeDaySchema.nullable(),
    ranking_available: z.boolean(),
    leader_user_ids: z.array(z.uuid()),
    /** Null with fewer than two competitors or unavailable ranking; zero on a tie. */
    lead_margin: z.number().int().nonnegative().nullable(),
    entries: z.array(challengeLeaderboardEntrySchema),
  })
  .superRefine((result, ctx) => {
    const workout = result.challenge.metric === "workout_time";
    if (
      (workout &&
        (result.contract_version !== 2 || result.score_unit !== "seconds")) ||
      (!workout &&
        result.score_unit !== undefined &&
        result.score_unit !== "steps")
    )
      ctx.addIssue({
        code: "custom",
        message: "Metric and score unit/version disagree",
      });
    for (const entry of result.entries) {
      if (
        entry.coverage.days_with_data === undefined &&
        (workout || entry.coverage.days_with_steps === undefined)
      )
        ctx.addIssue({ code: "custom", message: "Missing metric coverage" });
      if (
        workout &&
        (entry.total_workout_count === undefined ||
          entry.daily.some(
            (day) => day.workout_count === undefined || day.value < 0,
          ) ||
          entry.total_score < 0 ||
          (entry.today !== null && entry.today.workout_count === undefined))
      )
        ctx.addIssue({ code: "custom", message: "Missing workout count" });
    }
  });
export type ChallengeLeaderboardResponse = z.infer<
  typeof challengeLeaderboardResponseSchema
>;
