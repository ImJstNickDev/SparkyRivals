import type { PoolClient } from 'pg';
import type {
  Challenge,
  ChallengeParticipant,
  ChallengeMembershipStatus,
  CreateChallengeRequest,
  ChallengeListQuery,
} from '@workspace/shared';
import { getClient } from '../db/poolManager.js';

export type ChallengeWithMembership = Challenge & {
  my_membership: ChallengeMembershipStatus;
};
export type ChallengeRosterRow = ChallengeParticipant & {
  display_name: string;
};

async function withClient<T>(
  actor: string,
  callback: (client: PoolClient) => Promise<T>,
  snapshot = false
): Promise<T> {
  const client: PoolClient = await getClient(actor, actor);
  try {
    await client.query(
      snapshot ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'
    );
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function readChallenge(
  client: PoolClient,
  id: string
): Promise<ChallengeWithMembership | null> {
  const result = await client.query<ChallengeWithMembership>(
    'SELECT c.*, public.challenge_membership(c.id) AS my_membership FROM public.challenges c WHERE c.id=$1',
    [id]
  );
  return result.rows[0] ?? null;
}
async function insertInvitation(
  client: PoolClient,
  actor: string,
  id: string,
  userId: string
): Promise<void> {
  await client.query(
    'INSERT INTO public.challenge_participants (challenge_id, user_id, invited_by_user_id) VALUES ($1,$2,$3)',
    [id, userId, actor]
  );
}

async function create(
  actor: string,
  input: CreateChallengeRequest
): Promise<string> {
  return withClient(actor, async (client) => {
    const result = await client.query<{ id: string }>(
      'INSERT INTO public.challenges (creator_user_id, name, metric, scoring_mode, start_date, end_date, timezone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [
        actor,
        input.name,
        input.metric,
        input.scoring_mode,
        input.start_date,
        input.end_date,
        input.timezone,
      ]
    );
    const id = result.rows[0]!.id;
    // Bounded batch, one insert for all requested invitations, atomically with creation.
    if (input.participant_ids.length)
      await client.query(
        'INSERT INTO public.challenge_participants (challenge_id, user_id, invited_by_user_id) SELECT $1, unnest($2::uuid[]), $3',
        [id, input.participant_ids, actor]
      );
    return id;
  });
}
async function detail(actor: string, id: string) {
  return withClient(
    actor,
    async (client) => {
      const challenge = await readChallenge(client, id);
      if (!challenge) return null;
      const roster = await client.query<ChallengeRosterRow>(
        'SELECT * FROM public.challenge_roster($1)',
        [id]
      );
      return { challenge, participants: roster.rows };
    },
    true
  );
}
async function list(
  actor: string,
  query: ChallengeListQuery
): Promise<ChallengeWithMembership[]> {
  return withClient(
    actor,
    async (client) => {
      const result = await client.query<ChallengeWithMembership>(
        "SELECT c.*, cp.status AS my_membership FROM public.challenge_participants cp JOIN public.challenges c ON c.id=cp.challenge_id WHERE cp.user_id=$1 AND cp.status IN ('pending','accepted') ORDER BY c.created_at DESC, c.id DESC LIMIT $2 OFFSET $3",
        [actor, query.limit + 1, query.offset]
      );
      return result.rows;
    },
    true
  );
}
async function invite(
  actor: string,
  id: string,
  userId: string
): Promise<void> {
  return withClient(actor, (client) =>
    insertInvitation(client, actor, id, userId)
  );
}
async function respond(
  actor: string,
  id: string,
  status: 'accepted' | 'declined' | 'left'
): Promise<boolean> {
  return withClient(actor, async (client) => {
    const result = await client.query(
      'UPDATE public.challenge_participants SET status=$1 WHERE challenge_id=$2 AND user_id=$3',
      [status, id, actor]
    );
    return (result.rowCount ?? 0) > 0;
  });
}
async function update(
  actor: string,
  id: string,
  change: { name: string } | { cancel: true }
): Promise<boolean> {
  return withClient(actor, async (client) => {
    const result =
      'name' in change
        ? await client.query(
            'UPDATE public.challenges SET name=$1 WHERE id=$2 AND creator_user_id=$3',
            [change.name, id, actor]
          )
        : await client.query(
            'UPDATE public.challenges SET cancelled_at=now() WHERE id=$1 AND creator_user_id=$2',
            [id, actor]
          );
    return (result.rowCount ?? 0) > 0;
  });
}
export interface ChallengeStepPoint {
  user_id: string;
  display_name: string;
  entry_date: string | null;
  steps: number | null;
  data_updated_at: Date | null;
}
async function leaderboard(actor: string, id: string) {
  return withClient(
    actor,
    async (client) => {
      const challenge = await readChallenge(client, id);
      if (!challenge) return null;
      const clock = await client.query<{ evaluated_at: Date }>(
        'SELECT CURRENT_TIMESTAMP AS evaluated_at'
      );
      const points = await client.query<ChallengeStepPoint>(
        'SELECT * FROM public.challenge_step_points($1)',
        [id]
      );
      return {
        challenge,
        points: points.rows,
        evaluated_at: clock.rows[0]!.evaluated_at,
      };
    },
    true
  );
}
export default { create, detail, list, invite, respond, update, leaderboard };
