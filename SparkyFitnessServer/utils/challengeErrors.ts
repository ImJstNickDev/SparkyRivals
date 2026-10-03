export class ChallengeError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ChallengeError';
  }
}

/** Do not leak FK existence, SQL text, or PostgreSQL constraint detail. */
export function rethrowChallengeWriteError(error: unknown): never {
  if (error instanceof ChallengeError) throw error;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  if (code === '23505')
    throw new ChallengeError(409, 'Participant already invited');
  if (code === '42501' || code === '23503')
    throw new ChallengeError(403, 'Invitation or action unavailable');
  if (code === '23514')
    throw new ChallengeError(409, 'Challenge state does not allow this action');
  throw error;
}
