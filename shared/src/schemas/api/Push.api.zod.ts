import { z } from "zod";

export const pushRegistrationRequestSchema = z
  .object({
    installation_id: z.uuid(),
    platform: z.enum(["ios", "android"]),
    expo_push_token: z
      .string()
      .max(256)
      .regex(/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/),
    account_guard: z.uuid(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const pushUnregisterRequestSchema = pushRegistrationRequestSchema.pick({
  installation_id: true,
  account_guard: true,
  revision: true,
});
export const pushRegistrationResponseSchema = z
  .object({
    enabled: z.boolean(),
    expires_at: z.iso.datetime().nullable(),
  })
  .strict();
export const remoteInvitationDataSchema = z
  .object({
    type: z.literal("challenge_invitation"),
    challengeId: z.uuid(),
    eventId: z.uuid(),
    accountGuard: z.uuid(),
  })
  .strict();
export type PushRegistrationRequest = z.infer<
  typeof pushRegistrationRequestSchema
>;
export type PushUnregisterRequest = z.infer<typeof pushUnregisterRequestSchema>;
export type PushRegistrationResponse = z.infer<
  typeof pushRegistrationResponseSchema
>;
