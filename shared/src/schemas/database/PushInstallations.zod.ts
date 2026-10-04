import { z } from "zod";
/** Internal database mirror; never returned from an API. */
export const pushInstallationsSchema = z.object({
  installation_id: z.uuid(),
  user_id: z.uuid(),
  platform: z.enum(["ios", "android"]).nullable(),
  token_hash: z.string().nullable(),
  token_ciphertext: z.string().nullable(),
  token_iv: z.string().nullable(),
  token_tag: z.string().nullable(),
  account_guard: z.uuid(),
  revision: z.coerce.number().int().positive(),
  enabled: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
  expires_at: z.date(),
});
