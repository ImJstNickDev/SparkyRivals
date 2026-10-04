import { z } from "zod";
export const pushDeliveriesSchema = z.object({
  id: z.uuid(),
  event_id: z.uuid(),
  installation_id: z.uuid(),
  account_guard: z.uuid(),
  token_hash: z.string(),
  state: z.enum(["pending", "ticket", "delivered", "suppressed", "failed"]),
  attempts: z.number().int().nonnegative(),
  receipt_attempts: z.number().int().nonnegative(),
  next_attempt_at: z.date(),
  ticket_id: z.string().nullable(),
  ticket_at: z.date().nullable(),
  error_code: z.string().nullable(),
  updated_at: z.date(),
});
