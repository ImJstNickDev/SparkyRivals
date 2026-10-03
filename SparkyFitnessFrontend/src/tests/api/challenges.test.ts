import { challengeApi } from '@/api/Challenges/challenges';
import { apiCall } from '@/api/api';
import {
  challengeConnectionsSchema,
  selectChallengeInvitees,
} from '@workspace/shared';
import {
  actor,
  peer,
  third,
  challenge,
  detail,
  results,
  connection,
} from '../fixtures/challenges';
jest.mock('@/api/api', () => ({ apiCall: jest.fn() }));
const api = jest.mocked(apiCall);
beforeEach(() => jest.resetAllMocks());
describe('Challenge API', () => {
  it('parses list pages', async () => {
    api.mockResolvedValue({
      challenges: [challenge],
      limit: 20,
      offset: 20,
      has_more: false,
    });
    expect((await challengeApi.list(20)).challenges).toEqual([challenge]);
    expect(api).toHaveBeenCalledWith('/v2/challenges', {
      params: { limit: 20, offset: 20 },
    });
  });
  it('reads detail and authoritative results', async () => {
    api.mockResolvedValueOnce(detail).mockResolvedValueOnce(results);
    expect(await challengeApi.detail(challenge.id)).toEqual(detail);
    expect(await challengeApi.results(challenge.id)).toEqual(results);
  });
  it('creates, renames and invites through the existing transport', async () => {
    api.mockResolvedValue(detail);
    await challengeApi.create({
      name: 'Steps',
      start_date: '2026-10-04',
      end_date: '2026-10-10',
      timezone: 'UTC',
      metric: 'steps',
      scoring_mode: 'sum',
      participant_ids: [peer],
    });
    await challengeApi.rename(challenge.id, 'Together');
    await challengeApi.invite(challenge.id, peer);
    expect(api).toHaveBeenCalledWith(`/v2/challenges/${challenge.id}`, {
      method: 'PATCH',
      body: { name: 'Together' },
    });
    expect(api).toHaveBeenCalledWith(
      `/v2/challenges/${challenge.id}/invitations`,
      { method: 'POST', body: { user_id: peer } }
    );
  });
  it.each(['accept', 'decline', 'leave', 'cancel'] as const)(
    'posts %s without target identity',
    async (action) => {
      api.mockResolvedValue(undefined);
      await challengeApi.respond(challenge.id, action);
      expect(api).toHaveBeenCalledWith(
        `/v2/challenges/${challenge.id}/${action}`,
        { method: 'POST', body: {} }
      );
    }
  );
  it('rejects invalid server contracts and propagates failures', async () => {
    api.mockResolvedValue({ entries: [] });
    await expect(challengeApi.results(challenge.id)).rejects.toThrow();
    api.mockRejectedValue(new Error('offline'));
    await expect(challengeApi.detail(challenge.id)).rejects.toThrow('offline');
  });
  it('uses existing relationships and strips emails/permissions', async () => {
    api.mockResolvedValue([
      {
        ...connection,
        family_email: 'private@example.test',
        access_permissions: { diary: true },
      },
    ]);
    expect(await challengeApi.connections()).toEqual([connection]);
    expect(api).toHaveBeenCalledWith('/identity/family-access');
  });
});
describe('relationship picker projection', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');
  it('supports either direction, deduplicates and excludes existing members', () => {
    const reverse = {
      ...connection,
      owner_user_id: peer,
      family_user_id: actor,
      owner_full_name: 'Marta',
    };
    expect(
      selectChallengeInvitees([connection, reverse], actor, [], now)
    ).toEqual([{ user_id: peer, display_name: 'Marta' }]);
    expect(selectChallengeInvitees([connection], actor, [peer], now)).toEqual(
      []
    );
  });
  it.each([
    { is_active: false },
    { status: 'pending' },
    { family_user_id: null },
    { access_start_date: '2026-10-04T00:00:00Z' },
    { access_end_date: '2026-10-03T00:00:00Z' },
    { owner_user_id: third },
    { family_user_id: actor },
  ])('rejects ineligible relationship %j', (patch) => {
    expect(
      selectChallengeInvitees([{ ...connection, ...patch }], actor, [], now)
    ).toEqual([]);
  });
  it('requires timestamp and account contracts', () => {
    expect(() =>
      challengeConnectionsSchema.parse([
        { ...connection, access_start_date: 'yesterday' },
      ])
    ).toThrow();
  });
});
