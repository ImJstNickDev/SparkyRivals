import { z } from 'zod';
import {
  createChallengeRequestSchema,
  inviteChallengeRequestSchema,
  renameChallengeRequestSchema,
  challengeDetailResponseSchema,
  challengeListResponseSchema,
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
