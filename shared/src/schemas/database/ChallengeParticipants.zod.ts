import { z } from "zod";

export const challengeMembershipStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "left",
  "withdrawn",
]);
export const challengeParticipantsSchema = z.object({
  challenge_id: z.uuid(),
  user_id: z.uuid(),
  status: challengeMembershipStatusSchema,
  target_value: z.number().positive().nullable().optional(),
  ready_at: z.date().nullable().optional(),
  target_revision: z.number().int().nonnegative().optional(),
  withdrawn_at: z.date().nullable().optional(),
  invited_by_user_id: z.uuid(),
  invited_at: z.date(),
  accepted_at: z.date().nullable(),
  declined_at: z.date().nullable(),
  left_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type ChallengeParticipant = z.infer<typeof challengeParticipantsSchema>;
export type ChallengeMembershipStatus = z.infer<
  typeof challengeMembershipStatusSchema
>;
