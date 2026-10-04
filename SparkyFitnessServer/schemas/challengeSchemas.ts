import { z } from 'zod';
import {
  challengeTargetRequestSchema,
  challengeReadyRequestSchema,
  createChallengeRequestSchema,
  inviteChallengeRequestSchema,
  renameChallengeRequestSchema,
  challengeDetailResponseSchema,
  challengeListResponseSchema,
  challengeLeaderboardResponseSchema,
} from '@workspace/shared';
export {
  createChallengeRequestSchema,
  inviteChallengeRequestSchema,
  renameChallengeRequestSchema,
  challengeIdParamsSchema,
  challengeListQuerySchema,
} from '@workspace/shared';

// Keep OpenAPI shapes generated from the same contract clients consume.
export const challengeOpenApiSchemas = {
  ChallengeTarget: z.toJSONSchema(challengeTargetRequestSchema, {
    target: 'openapi-3.0',
  }),
  ChallengeReady: z.toJSONSchema(challengeReadyRequestSchema, {
    target: 'openapi-3.0',
  }),
  ChallengeLeaderboard: z.toJSONSchema(challengeLeaderboardResponseSchema, {
    target: 'openapi-3.0',
  }),
  CreateChallenge: z.toJSONSchema(createChallengeRequestSchema, {
    target: 'openapi-3.0',
  }),
  InviteChallenge: z.toJSONSchema(inviteChallengeRequestSchema, {
    target: 'openapi-3.0',
  }),
  RenameChallenge: z.toJSONSchema(renameChallengeRequestSchema, {
    target: 'openapi-3.0',
  }),
  ChallengeDetail: z.toJSONSchema(challengeDetailResponseSchema, {
    target: 'openapi-3.0',
  }),
  ChallengeList: z.toJSONSchema(challengeListResponseSchema, {
    target: 'openapi-3.0',
  }),
};
