import { challengesApi } from '../../src/services/api/challengesApi';
import { apiFetch } from '../../src/services/api/apiClient';
import {
  peer,
  challenge,
  detail,
  results,
  connection,
} from '../helpers/challenges';
jest.mock('../../src/services/api/apiClient', () => ({ apiFetch: jest.fn() }));
const api = jest.mocked(apiFetch);
beforeEach(() => jest.resetAllMocks());
describe('Challenge API transport', () => {
  it('checks active uniqueness with one result and the server pagination sentinel', async () => {
    api.mockResolvedValue({
      challenges: [challenge],
      limit: 1,
      offset: 0,
      has_more: true,
    });
    expect((await challengesApi.list(0, 'active')).has_more).toBe(true);
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v2/challenges?limit=1&offset=0&view=active',
        headers: { 'X-Challenge-Contract-Version': '3' },
      })
    );
  });
  it('parses list, detail and server results', async () => {
    api
      .mockResolvedValueOnce({
        challenges: [challenge],
        limit: 20,
        offset: 20,
        has_more: false,
      })
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce(results);
    expect((await challengesApi.list(20)).challenges).toEqual([challenge]);
    expect(await challengesApi.detail(challenge.id)).toEqual(detail);
    expect(await challengesApi.results(challenge.id)).toEqual(results);
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v2/challenges?limit=20&offset=20',
        method: 'GET',
      })
    );
  });
  it('uses authenticated PATCH for rename and POST for creation/invitations', async () => {
    api.mockResolvedValue(detail);
    await challengesApi.rename(challenge.id, 'Together');
    await challengesApi.invite(challenge.id, peer);
    await challengesApi.create({
      name: 'Steps',
      start_date: '2026-10-04',
      end_date: '2026-10-10',
      timezone: 'UTC',
      metric: 'steps',
      scoring_mode: 'sum',
      participant_ids: [peer],
    });
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: `/api/v2/challenges/${challenge.id}`,
        method: 'PATCH',
        body: { name: 'Together' },
      })
    );
  });
  it.each(['accept', 'decline', 'leave', 'cancel'] as const)(
    'posts %s without a target user',
    async (action) => {
      api.mockResolvedValue(undefined);
      await challengesApi.respond(challenge.id, action);
      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: `/api/v2/challenges/${challenge.id}/${action}`,
          method: 'POST',
          body: {},
        })
      );
    }
  );
  it('reads existing relationships and strips private fields', async () => {
    api.mockResolvedValue([
      { ...connection, family_email: 'private@example.test' },
    ]);
    expect(await challengesApi.connections()).toEqual([connection]);
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/identity/family-access' })
    );
  });
  it('rejects malformed responses and propagates offline errors', async () => {
    api.mockResolvedValue({ entries: [] });
    await expect(challengesApi.results(challenge.id)).rejects.toThrow();
    api.mockRejectedValue(new Error('offline'));
    await expect(challengesApi.detail(challenge.id)).rejects.toThrow('offline');
  });
});
