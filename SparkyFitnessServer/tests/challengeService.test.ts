import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeDetailResponseSchema,
} from '@workspace/shared';
import repository, {
  type ChallengeWithMembership,
  type ChallengeRosterRow,
} from '../models/challengeRepository.js';
import service, { describeChallenge } from '../services/challengeService.js';
vi.mock('../models/challengeRepository.js', () => ({
  default: {
    create: vi.fn(),
    detail: vi.fn(),
    list: vi.fn(),
    invite: vi.fn(),
    respond: vi.fn(),
    update: vi.fn(),
  },
}));
const owner = '10000000-0000-4000-8000-000000000001';
const peer = '10000000-0000-4000-8000-000000000002';
const id = '20000000-0000-4000-8000-000000000001';
const timestamp = new Date('2026-01-01T00:00:00Z');
const today = todayInZone('UTC');
const base: ChallengeWithMembership = {
  id,
  creator_user_id: owner,
  name: 'Steps',
  metric: 'steps',
  scoring_mode: 'sum',
  start_date: addDays(today, 1),
  end_date: addDays(today, 7),
  timezone: 'UTC',
  cancelled_at: null,
  created_at: timestamp,
  updated_at: timestamp,
  my_membership: 'accepted',
};
const membership: ChallengeRosterRow = {
  challenge_id: id,
  user_id: owner,
  status: 'accepted',
  invited_by_user_id: owner,
  invited_at: timestamp,
  accepted_at: timestamp,
  declined_at: null,
  left_at: null,
  created_at: timestamp,
  updated_at: timestamp,
  display_name: 'Owner',
};
const input = {
  name: 'Steps',
  start_date: base.start_date,
  end_date: base.end_date,
  timezone: 'UTC',
};
function setDetail(changes: Partial<ChallengeWithMembership> = {}) {
  vi.mocked(repository.detail).mockResolvedValue({
    challenge: { ...base, ...changes },
    participants: [membership],
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  setDetail();
});

describe('Challenge request contracts', () => {
  it('defaults steps/sum and supports N invitations', () => {
    expect(
      createChallengeRequestSchema.parse({
        ...input,
        participant_ids: [owner, peer],
      })
    ).toMatchObject({
      metric: 'steps',
      scoring_mode: 'sum',
      participant_ids: [owner, peer],
    });
  });
  it.each([
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { start_date: '2026-02-30' },
    { end_date: addDays(base.start_date, -1) },
    { end_date: addDays(base.start_date, 366) },
    { timezone: 'Moon/Sea' },
    { metric: 'workouts' },
    { scoring_mode: 'best_day' },
    { participant_ids: [peer, peer] },
    { creator_user_id: peer },
    { participant_ids: Array(100).fill(peer) },
  ])('rejects invalid create input %j', (change) => {
    expect(
      createChallengeRequestSchema.safeParse({ ...input, ...change }).success
    ).toBe(false);
  });
});
describe('Challenge lifecycle/calendar semantics', () => {
  it.each([
    ['UTC', '2026-03-28T23:59:59Z', 'upcoming', '2026-03-28', null],
    ['UTC', '2026-03-29T00:00:00Z', 'active', '2026-03-29', 1],
    ['Europe/Rome', '2026-03-28T22:59:59Z', 'upcoming', '2026-03-28', null],
    ['Europe/Rome', '2026-03-28T23:00:00Z', 'active', '2026-03-29', 1],
    ['Europe/Rome', '2026-03-29T01:00:00Z', 'active', '2026-03-29', 1],
    ['Europe/Rome', '2026-03-30T21:59:59Z', 'active', '2026-03-30', 2],
    ['Europe/Rome', '2026-03-30T22:00:00Z', 'completed', '2026-03-31', null],
  ])('%s at %s', (timezone, now, lifecycle, day, currentDay) => {
    const result = describeChallenge(
      { ...base, start_date: '2026-03-29', end_date: '2026-03-30', timezone },
      new Date(now)
    );
    expect(result.lifecycle).toBe(lifecycle);
    expect(result.progress.today).toBe(day);
    expect(result.progress.current_day).toBe(currentDay);
    expect(result.progress.total_days).toBe(2);
  });
  it('handles repeated autumn hour and inclusive end day', () => {
    const c = {
      ...base,
      start_date: '2026-10-25',
      end_date: '2026-10-25',
      timezone: 'Europe/Rome',
    };
    for (const time of [
      '2026-10-25T00:30:00Z',
      '2026-10-25T01:30:00Z',
      '2026-10-25T22:59:59Z',
    ]) {
      expect(describeChallenge(c, new Date(time)).progress).toMatchObject({
        current_day: 1,
        total_days: 1,
        days_remaining: 1,
        elapsed_days: 0,
      });
    }
    expect(
      describeChallenge(c, new Date('2026-10-25T23:00:00Z')).lifecycle
    ).toBe('completed');
  });
  it('cancellation takes precedence', () => {
    expect(
      describeChallenge({ ...base, cancelled_at: timestamp })
    ).toMatchObject({
      lifecycle: 'cancelled',
      progress: { days_remaining: 0, current_day: null },
    });
  });
});
describe('Challenge service authorization and transitions', () => {
  it('creates and serializes shared contract', async () => {
    vi.mocked(repository.create).mockResolvedValue(id);
    const result = await service.create(
      owner,
      createChallengeRequestSchema.parse(input)
    );
    expect(challengeDetailResponseSchema.safeParse(result).success).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ participant_ids: [] })
    );
  });
  it('rejects creator self invitation', async () => {
    await expect(
      service.create(
        owner,
        createChallengeRequestSchema.parse({
          ...input,
          participant_ids: [owner],
        })
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.create).not.toHaveBeenCalled();
  });
  it.each([-1, 367])('rejects start offset %i', async (offset) => {
    const start = addDays(today, offset);
    await expect(
      service.create(
        owner,
        createChallengeRequestSchema.parse({
          ...input,
          start_date: start,
          end_date: start,
        })
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it('missing and inaccessible challenges have the same error', async () => {
    vi.mocked(repository.detail).mockResolvedValue(null);
    await expect(service.detail(peer, id)).rejects.toMatchObject({
      status: 404,
      message: 'Challenge not found',
    });
    await expect(service.invite(peer, id, owner)).rejects.toMatchObject({
      status: 404,
    });
  });
  it('only owner invites another user', async () => {
    await service.invite(owner, id, peer);
    expect(repository.invite).toHaveBeenCalledWith(owner, id, peer);
    await expect(service.invite(peer, id, owner)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.invite(owner, id, owner)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each(['accept', 'decline'] as const)(
    'invitee can %s, but cannot repeat',
    async (action) => {
      setDetail({ my_membership: 'pending' });
      vi.mocked(repository.respond).mockResolvedValue(true);
      await service.respond(peer, id, action);
      expect(repository.respond).toHaveBeenCalledWith(
        peer,
        id,
        action === 'accept' ? 'accepted' : 'declined'
      );
      setDetail({ my_membership: 'accepted' });
      await expect(service.respond(peer, id, action)).rejects.toMatchObject({
        status: 409,
      });
    }
  );
  it('accepted participant can leave completed challenges; creator and pending cannot', async () => {
    setDetail({ start_date: addDays(today, -7), end_date: addDays(today, -1) });
    vi.mocked(repository.respond).mockResolvedValue(true);
    await service.respond(peer, id, 'leave');
    expect(repository.respond).toHaveBeenCalledWith(peer, id, 'left');
    await expect(service.respond(owner, id, 'leave')).rejects.toMatchObject({
      status: 409,
    });
    setDetail({ my_membership: 'pending' });
    await expect(service.respond(peer, id, 'leave')).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each([
    { cancelled_at: timestamp },
    { start_date: addDays(today, -7), end_date: addDays(today, -1) },
  ])('closes invitations %j', async (change) => {
    setDetail({ ...change, my_membership: 'pending' });
    await expect(service.respond(peer, id, 'accept')).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.invite(owner, id, peer)).rejects.toMatchObject({
      status: 409,
    });
    vi.mocked(repository.respond).mockResolvedValue(true);
    await service.respond(peer, id, 'decline');
  });
  it('only owner renames upcoming and cancels upcoming/active', async () => {
    vi.mocked(repository.update).mockResolvedValue(true);
    await service.update(owner, id, { name: 'Better name' });
    await expect(
      service.update(peer, id, { cancel: true })
    ).rejects.toMatchObject({ status: 403 });
    setDetail({ start_date: today });
    await expect(
      service.update(owner, id, { name: 'Changed' })
    ).rejects.toMatchObject({ status: 409 });
    await service.update(owner, id, { cancel: true });
  });
  it.each([
    ['23505', 409],
    ['42501', 403],
    ['23503', 403],
    ['23514', 409],
  ] as const)('sanitizes database %s', async (code, status) => {
    vi.mocked(repository.invite).mockRejectedValue({
      code,
      detail: 'private sql/user information',
    });
    await expect(service.invite(owner, id, peer)).rejects.toMatchObject({
      status,
    });
    await expect(service.invite(owner, id, peer)).rejects.not.toHaveProperty(
      'detail'
    );
  });
  it('bounds list pagination', async () => {
    vi.mocked(repository.list).mockResolvedValue([base, base]);
    const result = await service.list(owner, { limit: 1, offset: 0 });
    expect(result.challenges).toHaveLength(1);
    expect(result.has_more).toBe(true);
  });
});
