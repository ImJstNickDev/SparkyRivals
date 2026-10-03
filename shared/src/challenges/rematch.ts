import type { ChallengeDetailResponse } from "../schemas/api/Challenges.api.zod.ts";
import { addDays, daysBetween, instantToDay } from "../utils/timezone.ts";
import { selectChallengeInvitees, type ChallengeConnection } from "./client.ts";

/** Editable creation draft only; prior membership never carries into a rematch. */
export function prepareChallengeRematch(
  detail: ChallengeDetailResponse,
  connections: ChallengeConnection[],
  actor: string,
  now = Date.now(),
) {
  const { challenge, participants } = detail;
  if (
    challenge.my_membership !== "accepted" ||
    !["completed", "cancelled"].includes(challenge.lifecycle)
  )
    return null;
  const eligible = new Set(
    selectChallengeInvitees(connections, actor, [], now).map((p) => p.user_id),
  );
  const previous = participants.filter(
    (p) => p.status === "accepted" && p.user_id !== actor,
  );
  const selected = previous
    .filter((p) => eligible.has(p.user_id))
    .map((p) => p.user_id);
  const start = addDays(instantToDay(now, challenge.timezone), 1);
  return {
    name: challenge.name,
    metric: challenge.metric,
    timezone: challenge.timezone,
    start_date: start,
    end_date: addDays(
      start,
      daysBetween(challenge.start_date, challenge.end_date),
    ),
    participant_ids: selected,
    omitted: previous.length - selected.length,
  };
}
export type ChallengeRematchDraft = NonNullable<
  ReturnType<typeof prepareChallengeRematch>
>;
