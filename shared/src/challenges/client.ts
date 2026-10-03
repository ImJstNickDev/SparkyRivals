import { z } from "zod";

/** Narrow view of the existing Family & Friends endpoint. Strip private fields. */
export const challengeConnectionsSchema = z.array(
  z.object({
    owner_user_id: z.uuid(),
    family_user_id: z.uuid().nullable(),
    owner_full_name: z.string().nullable().optional(),
    family_full_name: z.string().nullable().optional(),
    is_active: z.boolean(),
    status: z.string().nullable(),
    access_start_date: z.iso.datetime({ offset: true }),
    access_end_date: z.iso.datetime({ offset: true }).nullable(),
  }),
);
export type ChallengeConnection = z.infer<
  typeof challengeConnectionsSchema
>[number];
export interface ChallengeInvitee {
  user_id: string;
  display_name: string | null;
}

/** Picker candidates only. The server rechecks the relationship on each invite. */
export function selectChallengeInvitees(
  connections: ChallengeConnection[],
  actor: string,
  excluded: string[] = [],
  now = Date.now(),
): ChallengeInvitee[] {
  const candidates = new Map<string, ChallengeInvitee>();
  for (const connection of connections) {
    if (
      !connection.is_active ||
      connection.status !== "active" ||
      Date.parse(connection.access_start_date) > now ||
      (connection.access_end_date !== null &&
        Date.parse(connection.access_end_date) <= now)
    )
      continue;
    const outgoing = connection.owner_user_id === actor;
    if (!outgoing && connection.family_user_id !== actor) continue;
    const id = outgoing ? connection.family_user_id : connection.owner_user_id;
    if (!id || id === actor || excluded.includes(id)) continue;
    candidates.set(id, {
      user_id: id,
      display_name:
        (outgoing
          ? connection.family_full_name
          : connection.owner_full_name
        )?.trim() || null,
    });
  }
  return [...candidates.values()];
}
