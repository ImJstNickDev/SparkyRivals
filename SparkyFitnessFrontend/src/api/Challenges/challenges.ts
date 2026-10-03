import {
  challengeConnectionsSchema,
  challengeDetailResponseSchema,
  challengeLeaderboardResponseSchema,
  challengeListResponseSchema,
  type CreateChallengeRequest,
} from '@workspace/shared';
import { apiCall } from '@/api/api';

const path = (id: string) => `/v2/challenges/${encodeURIComponent(id)}`;
export const challengeApi = {
  list: async (offset = 0) =>
    challengeListResponseSchema.parse(
      await apiCall<unknown>('/v2/challenges', {
        params: { limit: 20, offset },
      })
    ),
  detail: async (id: string) =>
    challengeDetailResponseSchema.parse(await apiCall<unknown>(path(id))),
  results: async (id: string) =>
    challengeLeaderboardResponseSchema.parse(
      await apiCall<unknown>(`${path(id)}/leaderboard`)
    ),
  connections: async () =>
    challengeConnectionsSchema.parse(
      await apiCall<unknown>('/identity/family-access')
    ),
  create: async (body: CreateChallengeRequest) =>
    challengeDetailResponseSchema.parse(
      await apiCall<unknown>('/v2/challenges', { method: 'POST', body })
    ),
  rename: async (id: string, name: string) =>
    challengeDetailResponseSchema.parse(
      await apiCall<unknown>(path(id), { method: 'PATCH', body: { name } })
    ),
  invite: async (id: string, user_id: string) =>
    challengeDetailResponseSchema.parse(
      await apiCall<unknown>(`${path(id)}/invitations`, {
        method: 'POST',
        body: { user_id },
      })
    ),
  respond: async (
    id: string,
    action: 'accept' | 'decline' | 'leave' | 'cancel'
  ) => {
    await apiCall<unknown>(`${path(id)}/${action}`, {
      method: 'POST',
      body: {},
    });
  },
};
