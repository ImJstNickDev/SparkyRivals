import {
  challengeConnectionsSchema,
  challengeDetailResponseSchema,
  challengeLeaderboardResponseSchema,
  challengeListResponseSchema,
  type CreateChallengeRequest,
} from '@workspace/shared';
import { apiFetch } from './apiClient';

const path = (id: string) => `/api/v2/challenges/${encodeURIComponent(id)}`;
const request = (
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown
) =>
  apiFetch<unknown>({
    endpoint,
    method,
    body,
    serviceName: 'Challenges API',
    operation: 'update or read Challenge',
  });
export const challengesApi = {
  list: async (offset = 0) =>
    challengeListResponseSchema.parse(
      await request(`/api/v2/challenges?limit=20&offset=${offset}`)
    ),
  detail: async (id: string) =>
    challengeDetailResponseSchema.parse(await request(path(id))),
  results: async (id: string) =>
    challengeLeaderboardResponseSchema.parse(
      await request(`${path(id)}/leaderboard`)
    ),
  connections: async () =>
    challengeConnectionsSchema.parse(
      await request('/api/identity/family-access')
    ),
  create: async (body: CreateChallengeRequest) =>
    challengeDetailResponseSchema.parse(
      await request('/api/v2/challenges', 'POST', body)
    ),
  rename: async (id: string, name: string) =>
    challengeDetailResponseSchema.parse(
      await request(path(id), 'PATCH', { name })
    ),
  invite: async (id: string, user_id: string) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/invitations`, 'POST', { user_id })
    ),
  respond: async (
    id: string,
    action: 'accept' | 'decline' | 'leave' | 'cancel'
  ) => {
    await request(`${path(id)}/${action}`, 'POST', {});
  },
};
