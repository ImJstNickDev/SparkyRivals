import { ZodError } from "zod";

/** Only classify transport/contract failures; never display raw server errors. */
export function challengeReadIssue(
  error: unknown,
): "unavailable" | "unsupported" | "network" | undefined {
  if (!error) return undefined;
  if (error instanceof ZodError) return "unsupported";
  if (typeof error === "object" && error !== null) {
    const status =
      "statusCode" in error
        ? error.statusCode
        : "status" in error
          ? error.status
          : undefined;
    if (typeof status === "number" && [401, 403, 404, 410].includes(status))
      return "unavailable";
  }
  return "network";
}
export function challengeReadBlocked(error: unknown) {
  const issue = challengeReadIssue(error);
  return issue === "unavailable" || issue === "unsupported";
}
export function challengeReadRetry(attempt: number, error: unknown) {
  return !challengeReadBlocked(error) && attempt < 2;
}
