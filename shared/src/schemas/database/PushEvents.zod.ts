import { z } from "zod";
export const pushEventsSchema = z.object({
  id: z.uuid(),
  event_type: z.literal("challenge_invitation"),
  challenge_id: z.uuid(),
  user_id: z.uuid(),
  created_at: z.date(),
});
