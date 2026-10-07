import {
  createChallengeRequestSchema,
  challengeNameSchema,
  daysBetween,
  instantToDay,
  type ChallengeResponse,
  type ChallengeParticipantResponse,
  type ChallengeDetailResponse,
  type ChallengeListResponse,
  type ChallengeListQuery,
  type CreateChallengeRequest,
} from '@workspace/shared';
import repository, {
  type ChallengeWithMembership,
  type ChallengeRosterRow,
} from '../models/challengeRepository.js';
import {
  ChallengeError,
  rethrowChallengeWriteError,
} from '../utils/challengeErrors.js';

export function describeChallenge(
  challenge: ChallengeWithMembership,
  now = new Date()
): ChallengeResponse {
  const today = instantToDay(now, challenge.timezone);
  const totalDays =
    challenge.duration_days ??
    (challenge.start_date && challenge.end_date
      ? daysBetween(challenge.start_date, challenge.end_date) + 1
      : 1);
  const lifecycle = challenge.cancelled_at
    ? 'cancelled'
    : !challenge.start_date || !challenge.end_date
      ? 'lobby'
      : today < challenge.start_date
        ? 'upcoming'
        : today > challenge.end_date
          ? 'completed'
          : 'active';
  const elapsed = Math.max(
    0,
    Math.min(
      totalDays,
      challenge.start_date ? daysBetween(challenge.start_date, today) : 0
    )
  );
  return {
    ...challenge,
    created_at: challenge.created_at.toISOString(),
    updated_at: challenge.updated_at.toISOString(),
    locked_at: challenge.locked_at?.toISOString() ?? null,
    cancelled_at: challenge.cancelled_at?.toISOString() ?? null,
    lifecycle,
    progress: {
      today,
      total_days: totalDays,
      elapsed_days: elapsed,
      days_remaining: lifecycle === 'cancelled' ? 0 : totalDays - elapsed,
      current_day: lifecycle === 'active' ? elapsed + 1 : null,
    },
  };
}
function describeParticipant(
  row: ChallengeRosterRow
): ChallengeParticipantResponse {
  return {
    ...row,
    ready_at: row.ready_at?.toISOString() ?? null,
    withdrawn_at: row.withdrawn_at?.toISOString() ?? null,
    invited_at: row.invited_at.toISOString(),
    accepted_at: row.accepted_at?.toISOString() ?? null,
    declined_at: row.declined_at?.toISOString() ?? null,
    left_at: row.left_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
async function detail(
  actor: string,
  id: string
): Promise<ChallengeDetailResponse> {
  const result = await repository.detail(actor, id);
  if (!result) throw new ChallengeError(404, 'Challenge not found');
  return {
    challenge: describeChallenge(result.challenge),
    participants: result.participants.map(describeParticipant),
  };
}
async function list(
  actor: string,
  query: ChallengeListQuery,
  includeNewTypes = true
): Promise<ChallengeListResponse> {
  const rows = await repository.list(actor, query, includeNewTypes);
  const now = new Date();
  return {
    challenges: rows
      .slice(0, query.limit)
      .map((row) => describeChallenge(row, now)),
    ...query,
    has_more: rows.length > query.limit,
  };
}
async function create(
  actor: string,
  input: CreateChallengeRequest
): Promise<ChallengeDetailResponse> {
  const parsed = createChallengeRequestSchema.parse(input);
  const today = instantToDay(new Date(), parsed.timezone);
  if (
    parsed.start_date &&
    (parsed.start_date < today || daysBetween(today, parsed.start_date) > 366)
  )
    throw new ChallengeError(
      400,
      'Start date must be today or within the next 366 days'
    );
  if (parsed.participant_ids.includes(actor))
    throw new ChallengeError(400, 'Creator participates automatically');
  try {
    return await detail(actor, await repository.create(actor, parsed));
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
async function invite(
  actor: string,
  id: string,
  target: string
): Promise<ChallengeDetailResponse> {
  const { challenge } = await detail(actor, id);
  if (challenge.creator_user_id !== actor)
    throw new ChallengeError(403, 'Only the creator can invite');
  if (target === actor)
    throw new ChallengeError(409, 'Creator participates automatically');
  if (
    challenge.lifecycle === 'completed' ||
    challenge.lifecycle === 'cancelled' ||
    challenge.locked_at
  )
    throw new ChallengeError(409, 'Invitations are closed');
  try {
    await repository.invite(actor, id, target);
    return await detail(actor, id);
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
async function respond(
  actor: string,
  id: string,
  action: 'accept' | 'decline' | 'leave'
): Promise<void> {
  const { challenge } = await detail(actor, id);
  if (challenge.creator_user_id === actor)
    throw new ChallengeError(409, 'Creator must cancel instead of leaving');
  const expected = action === 'leave' ? 'accepted' : 'pending';
  if (challenge.my_membership !== expected)
    throw new ChallengeError(409, 'Invalid membership transition');
  if (
    action === 'accept' &&
    (challenge.lifecycle === 'completed' || challenge.lifecycle === 'cancelled')
  )
    throw new ChallengeError(409, 'Invitation is closed');
  try {
    if (
      !(await repository.respond(
        actor,
        id,
        action === 'accept'
          ? 'accepted'
          : action === 'decline'
            ? 'declined'
            : 'left'
      ))
    )
      throw new ChallengeError(404, 'Challenge not found');
  } catch (error) {
    rethrowChallengeWriteError(error);
  }
}
async function update(
  actor: string,
  id: string,
  change: { name: string } | { cancel: true }
): Promise<ChallengeDetailResponse> {
  const { challenge } = await detail(actor, id);
  if (challenge.creator_user_id !== actor)
    throw new ChallengeError(403, 'Only the creator can change the challenge');
  if (
    challenge.lifecycle === 'completed' ||
    challenge.lifecycle === 'cancelled' ||
    ('name' in change && !['upcoming', 'lobby'].includes(challenge.lifecycle))
  )
    throw new ChallengeError(
      409,
      'Challenge cannot be changed in this lifecycle'
    );
  const parsed =
    'name' in change
      ? { name: challengeNameSchema.parse(change.name) }
      : change;
  try {
    if (!(await repository.update(actor, id, parsed)))
      throw new ChallengeError(404, 'Challenge not found');
    return await detail(actor, id);
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
async function configure(
  actor: string,
  id: string,
  intent:
    | { target_value: number; expected_revision: number }
    | { ready: boolean; expected_revision: number }
): Promise<ChallengeDetailResponse> {
  const { challenge, participants } = await detail(actor, id);
  const own = participants.find((row) => row.user_id === actor);
  // A retry of the final Ready after activation is successful without mutating the lock.
  if (
    'ready' in intent &&
    intent.ready &&
    challenge.locked_at &&
    own?.ready_at &&
    own.target_revision === intent.expected_revision
  )
    return detail(actor, id);
  if (challenge.lifecycle !== 'lobby' || challenge.my_membership !== 'accepted')
    throw new ChallengeError(
      409,
      'Target and readiness are locked or unavailable'
    );
  try {
    const changed =
      'target_value' in intent
        ? await repository.configureTarget(
            actor,
            id,
            intent.target_value,
            intent.expected_revision
          )
        : await repository.setReady(
            actor,
            id,
            intent.ready,
            intent.expected_revision
          );
    if (!changed)
      throw new ChallengeError(
        409,
        'Target changed; refresh before confirming'
      );
    return detail(actor, id);
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
async function withdraw(
  actor: string,
  id: string,
  userId: string
): Promise<ChallengeDetailResponse> {
  const { challenge } = await detail(actor, id);
  if (challenge.creator_user_id !== actor)
    throw new ChallengeError(
      403,
      'Only the creator can withdraw an invitation'
    );
  if (challenge.lifecycle !== 'lobby')
    throw new ChallengeError(409, 'Invitations are locked');
  try {
    if (!(await repository.withdraw(actor, id, userId)))
      throw new ChallengeError(
        409,
        'Only pending invitations can be withdrawn'
      );
    return detail(actor, id);
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
async function removeParticipant(
  actor: string,
  id: string,
  userId: string
): Promise<ChallengeDetailResponse> {
  const { challenge } = await detail(actor, id);
  if (challenge.creator_user_id !== actor || userId === actor)
    throw new ChallengeError(
      403,
      'Only the creator can remove another participant'
    );
  if (challenge.lifecycle !== 'lobby')
    throw new ChallengeError(409, 'Participants are locked');
  try {
    if (!(await repository.removeParticipant(actor, id, userId)))
      throw new ChallengeError(
        409,
        'Only accepted lobby participants can be removed'
      );
    return detail(actor, id);
  } catch (error) {
    return rethrowChallengeWriteError(error);
  }
}
export default {
  create,
  detail,
  list,
  invite,
  respond,
  update,
  configure,
  withdraw,
  removeParticipant,
};
