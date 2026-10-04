import { beforeEach, describe, expect, it, vi } from 'vitest';
import repository from '../models/challengeRepository.js';
const { query, release, getClient } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  getClient: vi.fn(),
}));
vi.mock('../db/poolManager.js', () => ({ getClient }));
const actor = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  getClient.mockResolvedValue({ query, release });
});
describe('Challenge repository snapshots and bounded queries', () => {
  it.each([1, 2, 10, 100])(
    'uses exactly three SELECTs for %i participants',
    async (count) => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id,
              metric: 'steps',
              scoring_mode: 'sum',
              my_membership: 'accepted',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ evaluated_at: new Date() }] })
        .mockResolvedValueOnce({
          rows: Array.from({ length: count }, () => ({
            entry_date: null,
            steps: null,
          })),
        })
        .mockResolvedValueOnce({ rows: [] });
      const result = await repository.leaderboard(actor, id);
      expect(result?.points).toHaveLength(count);
      expect(getClient).toHaveBeenCalledWith(actor, actor);
      expect(query).toHaveBeenCalledTimes(5);
      expect(query.mock.calls[0]).toEqual([
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
      ]);
      expect(query.mock.calls[3]?.[0]).toContain('steps AS value');
      expect(query.mock.calls[3]?.[0]).toContain(
        'public.challenge_step_points($1)'
      );
      expect(query.mock.calls[3]?.[0]).toContain('p.value::text AS raw_value');
      expect(query.mock.calls[3]?.[1]).toEqual([id]);
      expect(query.mock.calls[4]).toEqual(['COMMIT']);
      expect(release).toHaveBeenCalledOnce();
    }
  );
  it.each([1, 10, 100])(
    'uses the same bounded snapshot for %i workout participants',
    async (count) => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id, metric: 'workout_time', my_membership: 'accepted' }],
        })
        .mockResolvedValueOnce({ rows: [{ evaluated_at: new Date() }] })
        .mockResolvedValueOnce({
          rows: Array.from({ length: count }, () => ({
            entry_date: null,
            value: null,
          })),
        })
        .mockResolvedValueOnce({ rows: [] });
      expect((await repository.leaderboard(actor, id))?.points).toHaveLength(
        count
      );
      expect(query).toHaveBeenCalledTimes(5);
      expect(query.mock.calls[3]?.[0]).toContain('metric_value AS value');
      expect(query.mock.calls[3]?.[0]).toContain(
        'public.challenge_workout_points($1)'
      );
    }
  );
  it('does not project scores for an invisible challenge', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await repository.leaderboard(actor, id)).toBeNull();
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('rolls back and releases on failure', async () => {
    const error = new Error('database failure');
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ rows: [] });
    await expect(repository.leaderboard(actor, id)).rejects.toBe(error);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
