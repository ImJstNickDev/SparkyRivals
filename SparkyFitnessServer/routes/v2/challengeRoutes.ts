import express from 'express';
import { z } from 'zod';
import {
  challengeReadyRequestSchema,
  challengeTargetRequestSchema,
  challengeInvitationParamsSchema,
} from '@workspace/shared';
import { getChallengeLeaderboard } from '../../services/challengeLeaderboardService.js';
import service from '../../services/challengeService.js';
import { ChallengeError } from '../../utils/challengeErrors.js';
import {
  createChallengeRequestSchema,
  inviteChallengeRequestSchema,
  renameChallengeRequestSchema,
  challengeIdParamsSchema,
  challengeListQuerySchema,
} from '../../schemas/challengeSchemas.js';

const router = express.Router();
// Global authentication supports sessions and API keys. Competition consent is
// personal: reject every switched context, including an original actor mismatch.
router.use((req, res, next) => {
  const actor = req.originalUserId || req.authenticatedUserId || req.userId;
  if (!actor || !req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (
    actor !== req.userId ||
    (req.authenticatedUserId && req.authenticatedUserId !== actor)
  ) {
    res
      .status(403)
      .json({ error: 'Challenges require your own account context' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.post('/', async (req, res) => {
  const body = createChallengeRequestSchema.parse(req.body);
  res.status(201).json(await service.create(req.userId, body));
});
router.get('/', async (req, res) => {
  res.json(
    await service.list(
      req.userId,
      challengeListQuerySchema
        // React Native's existing no-store transport adds a timestamp. It is
        // transport metadata only; never forward it as a domain selector.
        .extend({
          _: z
            .string()
            .regex(/^\d{1,20}$/)
            .optional(),
        })
        .transform(({ limit, offset }) => ({ limit, offset }))
        .parse(req.query),
      req.get('X-Challenge-Contract-Version') === '3'
    )
  );
});
router.use('/:id', async (req, res, next) => {
  if (req.get('X-Challenge-Contract-Version') === '3') {
    next();
    return;
  }
  const { id } = challengeIdParamsSchema.parse(req.params);
  const { challenge } = await service.detail(req.userId, id);
  if (
    challenge.scoring_mode !== 'sum' ||
    !['steps', 'workout_time'].includes(challenge.metric)
  ) {
    res.status(409).json({
      error: 'Update SparkyRivals to open this Challenge type',
      code: 'CHALLENGE_CLIENT_UPDATE_REQUIRED',
    });
    return;
  }
  next();
});
router.put('/:id/target', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  res.json(
    await service.configure(
      req.userId,
      id,
      challengeTargetRequestSchema.parse(req.body)
    )
  );
});
router.put('/:id/ready', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  res.json(
    await service.configure(
      req.userId,
      id,
      challengeReadyRequestSchema.parse(req.body)
    )
  );
});
router.delete('/:id/invitations/:userId', async (req, res) => {
  const { id, userId } = challengeInvitationParamsSchema.parse(req.params);
  res.json(await service.withdraw(req.userId, id, userId));
});
router.get('/:id/leaderboard', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  res.json(await getChallengeLeaderboard(req.userId, id));
});
router.get('/:id', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  res.json(await service.detail(req.userId, id));
});
router.patch('/:id', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  res.json(
    await service.update(
      req.userId,
      id,
      renameChallengeRequestSchema.parse(req.body)
    )
  );
});
router.post('/:id/invitations', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  const { user_id } = inviteChallengeRequestSchema.parse(req.body);
  res.status(201).json(await service.invite(req.userId, id, user_id));
});
for (const action of ['accept', 'decline', 'leave'] as const) {
  router.post(`/:id/${action}`, async (req, res) => {
    const { id } = challengeIdParamsSchema.parse(req.params);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    await service.respond(req.userId, id, action);
    res.status(204).end();
  });
}
router.post('/:id/cancel', async (req, res) => {
  const { id } = challengeIdParamsSchema.parse(req.params);
  z.object({})
    .strict()
    .parse(req.body ?? {});
  res.json(await service.update(req.userId, id, { cancel: true }));
});
const handleError: express.ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: 'Invalid request',
      details: error.issues.map(({ path, message }) => ({ path, message })),
    });
    return;
  }
  if (error instanceof ChallengeError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
};
router.use(handleError);
export default router;

/**
 * @swagger
 * tags:
 *   - name: Challenges
 *     description: Private, explicitly consented, server-authoritative step competitions. Self account context only.
 * components:
 *   parameters:
 *     ChallengeId:
 *       in: path
 *       name: id
 *       required: true
 *       schema: { type: string, format: uuid }
 *   responses:
 *     ChallengeDetailResult:
 *       description: Rules, server lifecycle/progress and authorized membership roster; never unrelated health data.
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeDetail' }
 *     ChallengeUnavailable:
 *       description: Challenge does not exist or is inaccessible to this actor.
 * /v2/challenges:
 *   post:
 *     summary: Create a challenge and atomically invite existing active relationships
 *     tags: [Challenges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateChallenge' }
 *     responses:
 *       '201': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '400': { description: Invalid rules or dates }
 *       '403': { description: Invitation unavailable or switched context }
 *   get:
 *     summary: List the caller's pending and accepted challenges
 *     tags: [Challenges]
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 50, default: 20 } }
 *       - { in: query, name: offset, schema: { type: integer, minimum: 0, maximum: 10000, default: 0 } }
 *     responses:
 *       '200':
 *         description: Newest creation first; stable ID tie-break, bounded pagination.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ChallengeList' }
 * /v2/challenges/{id}:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   get:
 *     summary: Preview rules and authorized membership
 *     tags: [Challenges]
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '404': { $ref: '#/components/responses/ChallengeUnavailable' }
 *   patch:
 *     summary: Creator renames an upcoming challenge; rules are immutable
 *     tags: [Challenges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RenameChallenge' }
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '403': { description: Creator required }
 *       '409': { description: Challenge is no longer upcoming }
 * /v2/challenges/{id}/invitations:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   post:
 *     summary: Creator invites an existing active family relationship by user ID
 *     tags: [Challenges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InviteChallenge' }
 *     responses:
 *       '201': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '403': { description: Unauthorized actor or unavailable relationship (including unknown accounts) }
 *       '409': { description: Duplicate membership, capacity reached or invitations closed }
 * /v2/challenges/{id}/accept:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   post:
 *     summary: Invitee consents to share steps for the entire challenge date range
 *     tags: [Challenges]
 *     responses:
 *       '204': { description: Accepted; read current detail or leaderboard separately }
 *       '409': { description: Invitation is not pending or acceptance has closed }
 * /v2/challenges/{id}/decline:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   post:
 *     summary: Invitee declines and loses challenge access
 *     tags: [Challenges]
 *     responses:
 *       '204': { description: Declined }
 *       '409': { description: Invitation is not pending }
 * /v2/challenges/{id}/leave:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   post:
 *     summary: Accepted noncreator revokes participation and step sharing, including after completion
 *     tags: [Challenges]
 *     responses:
 *       '204': { description: Left; future results exclude this participant }
 *       '409': { description: Not accepted or creator must cancel instead }
 * /v2/challenges/{id}/cancel:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   post:
 *     summary: Creator irreversibly cancels an upcoming or active challenge
 *     tags: [Challenges]
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '403': { description: Creator required }
 *       '409': { description: Already cancelled or completed }
 */

/**
 * @swagger
 * /v2/challenges/{id}/leaderboard:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   get:
 *     summary: Authoritative daily and total steps for accepted competitors
 *     description: Reads canonical date buckets through today in the challenge timezone. Completed results reconcile on every request. Missing data scores zero with present=false. Cancellation stops sharing; upcoming ranks are null. No cache or final winner.
 *     tags: [Challenges]
 *     responses:
 *       '200':
 *         description: Versioned server result with ranks, ties, gaps and coverage.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ChallengeLeaderboard' }
 *       '403': { description: Invitation acceptance required }
 *       '404': { $ref: '#/components/responses/ChallengeUnavailable' }
 */

/**
 * @swagger
 * /v2/challenges/{id}/target:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   put:
 *     summary: Set own lobby target and clear Ready using an expected revision
 *     tags: [Challenges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeTarget' }
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '409': { description: Locked lobby or obsolete target revision }
 * /v2/challenges/{id}/ready:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *   put:
 *     summary: Confirm or revoke own Ready state; the server atomically locks an all-ready lobby
 *     tags: [Challenges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChallengeReady' }
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '409': { description: Locked lobby or obsolete target revision }
 * /v2/challenges/{id}/invitations/{userId}:
 *   parameters:
 *     - { $ref: '#/components/parameters/ChallengeId' }
 *     - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *   delete:
 *     summary: Creator withdraws a pending invitation from an unlocked goal lobby
 *     tags: [Challenges]
 *     responses:
 *       '200': { $ref: '#/components/responses/ChallengeDetailResult' }
 *       '403': { description: Creator authorization required }
 *       '409': { description: Locked lobby or invitation no longer pending }
 */
