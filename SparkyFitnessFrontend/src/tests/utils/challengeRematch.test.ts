import { prepareChallengeRematch } from '@workspace/shared';
import { actor, detail, connection, peer } from '../fixtures/challenges';

describe('rematch draft', () => {
  it.each(['steps', 'workout_time'] as const)(
    'preserves %s rules and sends invitations, never memberships',
    (metric) => {
      const draft = prepareChallengeRematch(
        {
          ...detail,
          challenge: { ...detail.challenge, metric, lifecycle: 'completed' },
        },
        [connection],
        actor,
        Date.parse('2026-10-24T23:30:00Z')
      )!;
      expect(draft).toMatchObject({
        metric,
        name: detail.challenge.name,
        timezone: 'Europe/Rome',
        start_date: '2026-10-26',
        end_date: '2026-11-01',
        participant_ids: [peer],
        omitted: 0,
      });
      expect(draft).not.toHaveProperty('participants');
    }
  );
  it('uses tomorrow in UTC across spring DST, retaining inclusive duration', () => {
    const draft = prepareChallengeRematch(
      {
        ...detail,
        challenge: {
          ...detail.challenge,
          timezone: 'UTC',
          lifecycle: 'cancelled',
          start_date: '2026-03-28',
          end_date: '2026-03-29',
        },
      },
      [],
      actor,
      Date.parse('2026-03-28T23:30:00Z')
    )!;
    expect(draft).toMatchObject({
      start_date: '2026-03-29',
      end_date: '2026-03-30',
      omitted: 1,
      participant_ids: [],
    });
  });
  it('omits expired connections and nonaccepted participants', () => {
    const draft = prepareChallengeRematch(
      { ...detail, challenge: { ...detail.challenge, lifecycle: 'cancelled' } },
      [{ ...connection, is_active: false }],
      actor
    )!;
    expect(draft.participant_ids).toEqual([]);
    expect(draft.omitted).toBe(1);
  });
  it.each(['active', 'upcoming'] as const)(
    'does not rematch %s',
    (lifecycle) => {
      expect(
        prepareChallengeRematch(
          { ...detail, challenge: { ...detail.challenge, lifecycle } },
          [connection],
          actor
        )
      ).toBeNull();
    }
  );
  it('does not rematch a pending invitation', () => {
    expect(
      prepareChallengeRematch(
        {
          ...detail,
          challenge: {
            ...detail.challenge,
            lifecycle: 'completed',
            my_membership: 'pending',
          },
        },
        [connection],
        actor
      )
    ).toBeNull();
  });
});
