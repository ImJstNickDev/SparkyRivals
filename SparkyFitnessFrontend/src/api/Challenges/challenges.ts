import {
  challengeConnectionsSchema,
  challengeDetailResponseSchema,
  challengeLeaderboardResponseSchema,
  challengeListResponseSchema,
  type CreateChallengeRequest,
  type ChallengeListQuery,
} from '@workspace/shared';
import { apiCall } from '@/api/api';

const request = (
  endpoint: string,
  options: Parameters<typeof apiCall>[1] = {}
) =>
  apiCall<unknown>(endpoint, {
    ...options,
    headers: { ...options?.headers, 'X-Challenge-Contract-Version': '3' },
  });
const path = (id: string) => `/v2/challenges/${encodeURIComponent(id)}`;
export const challengeApi = {
  list: async (
    offset = 0,
    view?: ChallengeListQuery['view'],
    signal?: AbortSignal
  ) =>
    challengeListResponseSchema.parse(
      await request('/v2/challenges', {
        params: { limit: 20, offset, ...(view ? { view } : {}) },
        signal,
      })
    ),
  detail: async (id: string, signal?: AbortSignal) =>
    challengeDetailResponseSchema.parse(await request(path(id), { signal })),
  results: async (id: string, signal?: AbortSignal) =>
    challengeLeaderboardResponseSchema.parse(
      await request(`${path(id)}/leaderboard`, { signal })
    ),
  connections: async () =>
    challengeConnectionsSchema.parse(await apiCall('/identity/family-access')),
  create: async (body: CreateChallengeRequest) =>
    challengeDetailResponseSchema.parse(
      await request('/v2/challenges', { method: 'POST', body })
    ),
  rename: async (id: string, name: string) =>
    challengeDetailResponseSchema.parse(
      await request(path(id), { method: 'PATCH', body: { name } })
    ),
  invite: async (id: string, user_id: string) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/invitations`, {
        method: 'POST',
        body: { user_id },
      })
    ),
  target: async (id: string, target_value: number, expected_revision: number) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/target`, {
        method: 'PUT',
        body: { target_value, expected_revision },
      })
    ),
  ready: async (id: string, ready: boolean, expected_revision: number) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/ready`, {
        method: 'PUT',
        body: { ready, expected_revision },
      })
    ),
  withdraw: async (id: string, userId: string) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/invitations/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
    ),
  removeParticipant: async (id: string, userId: string) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/participants/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
    ),
  respond: async (
    id: string,
    action: 'accept' | 'decline' | 'leave' | 'cancel'
  ) => {
    await request(`${path(id)}/${action}`, {
      method: 'POST',
      body: {},
    });
  },
};
