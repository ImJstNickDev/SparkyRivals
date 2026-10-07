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
  my_ready?: boolean;
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
      'INSERT INTO public.challenges (creator_user_id, name, metric, scoring_mode, start_date, end_date, timezone,duration_days,start_next_day) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [
        actor,
        input.name,
        input.metric,
        input.scoring_mode,
        input.start_date,
        input.end_date,
        input.timezone,
        input.duration_days ?? null,
        input.start_next_day ?? false,
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
async function detail(
  actor: string,
  id: string
): Promise<{
  challenge: ChallengeWithMembership;
  participants: ChallengeRosterRow[];
} | null> {
  return withClient(
    actor,
    async (client) => {
      const challenge = await readChallenge(client, id);
      if (!challenge) return null;
      const roster = await client.query<ChallengeRosterRow>(
        'SELECT * FROM public.challenge_roster($1)',
        [id]
      );
      return {
        challenge,
        participants: roster.rows.map((row) => ({
          ...row,
          target_value:
            row.target_value === null || row.target_value === undefined
              ? null
              : Number(row.target_value),
        })),
      };
    },
    true
  );
}
async function list(
  actor: string,
  query: ChallengeListQuery,
  includeNewTypes = true
): Promise<ChallengeWithMembership[]> {
  return withClient(
    actor,
    async (client) => {
      const result = await client.query<ChallengeWithMembership>(
        `SELECT c.*, cp.status AS my_membership, cp.ready_at IS NOT NULL AS my_ready
         FROM public.challenge_participants cp
         JOIN public.challenges c ON c.id=cp.challenge_id
         CROSS JOIN LATERAL (SELECT CASE
           WHEN c.cancelled_at IS NOT NULL THEN 'cancelled'
           WHEN c.start_date IS NULL OR c.end_date IS NULL THEN 'lobby'
           WHEN (CURRENT_TIMESTAMP AT TIME ZONE c.timezone)::date < c.start_date THEN 'upcoming'
           WHEN (CURRENT_TIMESTAMP AT TIME ZONE c.timezone)::date > c.end_date THEN 'completed'
           ELSE 'active' END AS state) lifecycle
         WHERE cp.user_id=$1 AND cp.status IN ('pending','accepted')
           AND ($4 OR (c.scoring_mode='sum' AND c.metric IN ('steps','workout_time')))
           AND ($5::text IS NULL
             OR ($5='history' AND lifecycle.state IN ('completed','cancelled'))
             OR ($5='invitations' AND cp.status='pending' AND lifecycle.state NOT IN ('completed','cancelled'))
             OR ($5='mine' AND cp.status='accepted' AND lifecycle.state NOT IN ('completed','cancelled'))
             OR ($5='active' AND cp.status='accepted' AND lifecycle.state='active')
             OR ($5='summary' AND lifecycle.state NOT IN ('completed','cancelled')))
         ORDER BY CASE WHEN $5='summary' THEN CASE
           WHEN cp.status='pending' THEN 0
           WHEN lifecycle.state='lobby' AND cp.ready_at IS NULL THEN 1
           WHEN lifecycle.state='active' THEN 2
           WHEN lifecycle.state='lobby' THEN 3 ELSE 4 END ELSE 0 END,
           c.created_at DESC, c.id DESC LIMIT $2 OFFSET $3`,
        [
          actor,
          query.limit + 1,
          query.offset,
          includeNewTypes,
          query.view ?? null,
        ]
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
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
    await insertInvitation(client, actor, id, userId);
  });
}
async function respond(
  actor: string,
  id: string,
  status: 'accepted' | 'declined' | 'left'
): Promise<boolean> {
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
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
export interface ChallengeMetricPoint {
  user_id: string;
  display_name: string;
  entry_date: string | null;
  value: number | null;
  raw_value?: string | null;
  target_value?: string | number | null;
  workout_count?: number;
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
      const source =
        challenge.metric === 'steps'
          ? 'SELECT user_id, display_name, entry_date, steps AS value, data_updated_at FROM public.challenge_step_points($1)'
          : challenge.metric.startsWith('workout_')
            ? 'SELECT user_id, display_name, entry_date, metric_value AS value, workout_count, data_updated_at FROM public.challenge_workout_points($1)'
            : 'SELECT * FROM public.challenge_daily_metric_points($1)';
      const points = await client.query<ChallengeMetricPoint>(
        `SELECT p.*, p.value::text AS raw_value, cp.target_value FROM (${source}) p JOIN public.challenge_participants cp ON cp.challenge_id=$1 AND cp.user_id=p.user_id`,
        [id]
      );
      return {
        challenge,
        points: points.rows.map((row) => ({
          ...row,
          value:
            row.value === null || row.value === undefined
              ? null
              : Number(row.value),
        })),
        evaluated_at: clock.rows[0]!.evaluated_at,
      };
    },
    true
  );
}
async function lockChallenge(client: PoolClient, id: string): Promise<void> {
  await client.query('SELECT public.lock_challenge_participation($1)', [id]);
}
async function configureTarget(
  actor: string,
  id: string,
  target: number,
  revision: number
): Promise<boolean> {
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
    const result = await client.query(
      'UPDATE public.challenge_participants SET target_value=$1 WHERE challenge_id=$2 AND user_id=$3 AND target_revision=$4 RETURNING user_id',
      [target, id, actor, revision]
    );
    return (result.rowCount ?? 0) === 1;
  });
}
async function setReady(
  actor: string,
  id: string,
  ready: boolean,
  revision: number
): Promise<boolean> {
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
    const current = await client.query<{
      locked_at: Date | null;
      ready_at: Date | null;
      target_revision: number;
    }>(
      "SELECT c.locked_at,cp.ready_at,cp.target_revision FROM public.challenges c JOIN public.challenge_participants cp ON cp.challenge_id=c.id WHERE c.id=$1 AND cp.user_id=$2 AND cp.status='accepted'",
      [id, actor]
    );
    const row = current.rows[0];
    if (
      ready &&
      row?.locked_at &&
      row.ready_at &&
      row.target_revision === revision
    )
      return true;
    const result = await client.query(
      'UPDATE public.challenge_participants SET ready_at=CASE WHEN $1 THEN now() ELSE NULL END WHERE challenge_id=$2 AND user_id=$3 AND target_revision=$4 RETURNING user_id',
      [ready, id, actor, revision]
    );
    return (result.rowCount ?? 0) === 1;
  });
}
async function withdraw(
  actor: string,
  id: string,
  userId: string
): Promise<boolean> {
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
    const result = await client.query(
      "UPDATE public.challenge_participants SET status='withdrawn' WHERE challenge_id=$1 AND user_id=$2 AND status='pending'",
      [id, userId]
    );
    return (result.rowCount ?? 0) === 1;
  });
}
async function removeParticipant(
  actor: string,
  id: string,
  userId: string
): Promise<boolean> {
  return withClient(actor, async (client) => {
    await lockChallenge(client, id);
    const result = await client.query(
      `UPDATE public.challenge_participants SET status='left'
       WHERE challenge_id=$1 AND user_id=$2 AND user_id<>$3 AND status='accepted'`,
      [id, userId, actor]
    );
    return (result.rowCount ?? 0) === 1;
  });
}
export default {
  create,
  detail,
  list,
  invite,
  respond,
  update,
  leaderboard,
  configureTarget,
  setReady,
  withdraw,
  removeParticipant,
};
