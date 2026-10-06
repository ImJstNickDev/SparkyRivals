import {
  challengeConnectionsSchema,
  challengeDetailResponseSchema,
  challengeLeaderboardResponseSchema,
  challengeListResponseSchema,
  type CreateChallengeRequest,
  type ChallengeListQuery,
} from '@workspace/shared';
import { apiFetch } from './apiClient';

const path = (id: string) => `/api/v2/challenges/${encodeURIComponent(id)}`;
const request = (
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  signal?: AbortSignal
) =>
  apiFetch<unknown>({
    endpoint,
    method,
    body,
    signal,
    headers: { 'X-Challenge-Contract-Version': '3' },
    serviceName: 'Challenges API',
    operation: 'update or read Challenge',
  });
export const challengesApi = {
  list: async (
    offset = 0,
    view?: ChallengeListQuery['view'],
    signal?: AbortSignal
  ) =>
    challengeListResponseSchema.parse(
      await request(
        `/api/v2/challenges?limit=${view === 'summary' ? 1 : 20}&offset=${offset}${view ? `&view=${view}` : ''}`,
        'GET',
        undefined,
        signal
      )
    ),
  detail: async (id: string, signal?: AbortSignal) =>
    challengeDetailResponseSchema.parse(
      await request(path(id), 'GET', undefined, signal)
    ),
  results: async (id: string, signal?: AbortSignal) =>
    challengeLeaderboardResponseSchema.parse(
      await request(`${path(id)}/leaderboard`, 'GET', undefined, signal)
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
  target: async (id: string, target_value: number, expected_revision: number) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/target`, 'PUT', {
        target_value,
        expected_revision,
      })
    ),
  ready: async (id: string, ready: boolean, expected_revision: number) =>
    challengeDetailResponseSchema.parse(
      await request(`${path(id)}/ready`, 'PUT', { ready, expected_revision })
    ),
  withdraw: async (id: string, userId: string) =>
    challengeDetailResponseSchema.parse(
      await request(
        `${path(id)}/invitations/${encodeURIComponent(userId)}`,
        'DELETE'
      )
    ),
  removeParticipant: async (id: string, userId: string) =>
    challengeDetailResponseSchema.parse(
      await request(
        `${path(id)}/participants/${encodeURIComponent(userId)}`,
        'DELETE'
      )
    ),
  respond: async (
    id: string,
    action: 'accept' | 'decline' | 'leave' | 'cancel'
  ) => {
    await request(`${path(id)}/${action}`, 'POST', {});
  },
};
