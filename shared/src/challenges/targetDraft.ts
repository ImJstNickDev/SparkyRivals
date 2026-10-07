import type { ChallengeDetailResponse } from "../schemas/api/Challenges.api.zod.ts";

export class TargetSavedReadyFailed extends Error {
  constructor() {
    super("CHALLENGE_TARGET_SAVED_READY_FAILED");
  }
}

/** Orchestrate existing APIs; Ready always uses the acknowledged revision. */
export async function confirmChallengeReady({
  actor,
  target,
  revision,
  savedTarget,
  save,
  ready,
  current,
}: {
  actor: string;
  target: number;
  revision: number;
  savedTarget: number | null;
  save: (target: number, revision: number) => Promise<ChallengeDetailResponse>;
  ready: (revision: number) => Promise<ChallengeDetailResponse>;
  current: () => boolean;
}) {
  if (!current()) throw new Error("CHALLENGE_SESSION_CHANGED");
  let acknowledged = revision;
  const changed = savedTarget !== target;
  if (changed) {
    const detail = await save(target, revision);
    if (!current()) throw new Error("CHALLENGE_SESSION_CHANGED");
    acknowledged = acknowledgeChallengeTarget(detail, actor, target).revision;
  }
  if (!current()) throw new Error("CHALLENGE_SESSION_CHANGED");
  try {
    const detail = await ready(acknowledged);
    if (!current()) throw new Error("CHALLENGE_SESSION_CHANGED");
    return detail;
  } catch (error) {
    if (changed && current()) throw new TargetSavedReadyFailed();
    throw error;
  }
}

/** Only a server response can advance the target revision used for Ready. */
export function acknowledgeChallengeTarget(
  detail: ChallengeDetailResponse,
  actor: string,
  target: number,
) {
  const own = detail.participants.find((p) => p.user_id === actor);
  if (
    detail.challenge.lifecycle !== "lobby" ||
    own?.status !== "accepted" ||
    own.target_value !== target ||
    own.target_revision == null
  )
    throw new Error("CHALLENGE_RECONFIRM_REQUIRED");
  return { value: own.target_value, revision: own.target_revision };
}
