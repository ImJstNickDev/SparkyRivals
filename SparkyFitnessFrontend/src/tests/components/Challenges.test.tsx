import { ChallengeInvitees } from '@/pages/Challenges/ChallengeInvitees';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import english from '../../../public/locales/en/translation.json';
import ChallengesPage from '@/pages/Challenges/ChallengesPage';
import ChallengeDetailPage from '@/pages/Challenges/ChallengeDetailPage';
import CreateChallengePage from '@/pages/Challenges/CreateChallengePage';
import {
  ChallengeScores,
  ChallengeDailyHistory,
} from '@/pages/Challenges/ChallengeScores';
import * as hooks from '@/hooks/Challenges/useChallenges';
import {
  actor,
  peer,
  third,
  challenge,
  detail,
  results,
  workoutResults,
  connection,
} from '../fixtures/challenges';
jest.mock('@/hooks/Challenges/useChallenges');
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: jest.fn(() => ({
    isActingOnBehalf: false,
    switchToUser: jest.fn(),
  })),
}));
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ timezone: 'Europe/Rome' }),
}));
const h = jest.mocked(hooks);
const mutateAsync = jest.fn();
const refetch = jest.fn();
const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: english } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
const query = <T,>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch,
});
function show(ui: React.ReactElement, path = '/challenges') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/challenges/:id" element={ui} />
          <Route path="/challenges" element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useActiveUser).mockReturnValue({
    isActingOnBehalf: false,
    switchToUser: jest.fn(),
  } as unknown as ReturnType<typeof useActiveUser>);
  h.useChallengeRefresh.mockReturnValue(refetch);
  h.useChallengeIdentity.mockReturnValue({ actor, enabled: true });
  h.useChallenges.mockReturnValue({
    ...query({ pages: [{ challenges: [challenge] }] }),
    hasNextPage: false,
  } as unknown as ReturnType<typeof hooks.useChallenges>);
  h.useChallengeDetail.mockReturnValue(
    query(detail) as unknown as ReturnType<typeof hooks.useChallengeDetail>
  );
  h.useChallengeResults.mockReturnValue(
    query(results) as unknown as ReturnType<typeof hooks.useChallengeResults>
  );
  h.useChallengeConnections.mockReturnValue(
    query([connection]) as unknown as ReturnType<
      typeof hooks.useChallengeConnections
    >
  );
  h.useChallengeMutation.mockReturnValue({
    mutateAsync,
    reset: jest.fn(),
    isPending: false,
    isError: false,
  } as unknown as unknown as ReturnType<typeof hooks.useChallengeMutation>);
  mutateAsync.mockResolvedValue(detail);
});
describe('Challenge hub', () => {
  it('groups invitations, active, upcoming, completed and cancelled', () => {
    h.useChallenges.mockReturnValue({
      ...query({
        pages: [
          {
            challenges: [
              { ...challenge, id: 'pending', my_membership: 'pending' },
              challenge,
              ...(['upcoming', 'completed', 'cancelled'] as const).map(
                (lifecycle) => ({ ...challenge, id: lifecycle, lifecycle })
              ),
            ],
          },
        ],
      }),
      hasNextPage: false,
    } as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />);
    for (const name of [
      'Invitations',
      'Active',
      'Upcoming',
      'Completed',
      'Cancelled',
    ])
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Review invitation/ })
    ).toBeInTheDocument();
    expect(screen.getAllByText('54,280').length).toBeGreaterThan(0);
  });
  it('renders an invitation without displaying scores', () => {
    h.useChallenges.mockReturnValue({
      ...query({
        pages: [{ challenges: [{ ...challenge, my_membership: 'pending' }] }],
      }),
    } as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />);
    expect(screen.queryByText('54,280')).not.toBeInTheDocument();
    expect(screen.getByText(/Review the rules/)).toBeInTheDocument();
  });
  it('refreshes and loads older competitions', () => {
    const fetchNextPage = jest.fn();
    h.useChallenges.mockReturnValue({
      ...query({ pages: [{ challenges: [challenge] }] }),
      hasNextPage: true,
      fetchNextPage,
    } as unknown as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Challenges' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(refetch).toHaveBeenCalled();
    expect(fetchNextPage).toHaveBeenCalled();
  });
  it.each(['loading', 'error', 'empty'])('renders %s state', (state) => {
    h.useChallenges.mockReturnValue({
      ...query({ pages: [{ challenges: [] }] }),
      isPending: state === 'loading',
      isError: state === 'error',
    } as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />);
    if (state === 'loading')
      expect(screen.getByRole('status')).toBeInTheDocument();
    else if (state === 'error')
      expect(screen.getByRole('alert')).toBeInTheDocument();
    else
      expect(
        screen.getByText('Go a little further, together')
      ).toBeInTheDocument();
  });
});
describe('scores and daily history', () => {
  it('shows server ranks, gap, today, zero and absent days', () => {
    show(
      <>
        <ChallengeScores result={results} actor={actor} />
        <ChallengeDailyHistory result={results} actor={actor} />
      </>
    );
    expect(screen.getByText('Nico leads by 2,287 steps')).toBeInTheDocument();
    expect(screen.getByText('Rank 2')).toBeInTheDocument();
    expect(screen.getByText('Today: 0')).toBeInTheDocument();
    expect(screen.getByText('Today: No step data')).toBeInTheDocument();
    expect(screen.getByText('0 steps')).toBeInTheDocument();
    expect(screen.getAllByText('No step data').length).toBeGreaterThan(0);
    expect(screen.getByText('Nico ahead this day')).toBeInTheDocument();
  });
  it('uses supplied tie ranks and shared leaders', () => {
    const tied = {
      ...results,
      leader_user_ids: [actor, peer],
      lead_margin: 0,
      entries: results.entries.map((e) => ({
        ...e,
        rank: 1,
        is_tied: true,
        total_score: 10,
      })),
    };
    show(<ChallengeScores result={tied} actor={actor} />);
    expect(
      screen.getByText('Nico and Marta share the lead')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Rank 1 · Tied')).toHaveLength(2);
  });
  it('supports 100 people and selects whose daily history to show', () => {
    const group = {
      ...results,
      entries: [
        ...results.entries,
        ...Array.from({ length: 98 }, (_, index) => ({
          ...results.entries[1]!,
          user_id: `${third}-${index}`,
          display_name: `Friend ${index}`,
          rank: index + 3,
        })),
      ],
    };
    show(
      <>
        <ChallengeScores result={group} actor={actor} />
        <ChallengeDailyHistory result={group} actor={actor} />
      </>
    );
    expect(
      within(screen.getByRole('list', { name: 'Leaderboard' })).getAllByRole(
        'listitem'
      )
    ).toHaveLength(100);
    fireEvent.change(screen.getByLabelText('Participant'), {
      target: { value: `${third}-97` },
    });
    expect(screen.getAllByText('Friend 97').length).toBeGreaterThan(1);
  });
  it('paginates long daily history without rendering every day at once', () => {
    const long = {
      ...results,
      entries: results.entries.map((e) => ({
        ...e,
        daily: Array.from({ length: 28 }, (_, i) => ({
          date: `2026-10-${String(i + 1).padStart(2, '0')}`,
          value: 0,
          present: true,
          eligible: true,
        })),
      })),
    };
    show(<ChallengeDailyHistory result={long} actor={actor} />);
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Earlier days'));
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.queryByText('Oct 1, 2026')).not.toBeInTheDocument();
  });
});
describe('detail and membership actions', () => {
  it('shows completed results with reconciliation explanation', () => {
    h.useChallengeDetail.mockReturnValue(
      query({
        ...detail,
        challenge: { ...challenge, lifecycle: 'completed' },
      }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
    );
    show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
    expect(screen.getByText('Current results')).toBeInTheDocument();
    expect(screen.getByText(/Results can change/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel Challenge' })
    ).not.toBeInTheDocument();
  });
  it('subdues cancelled state and never renders cached results', () => {
    h.useChallengeDetail.mockReturnValue(
      query({
        ...detail,
        challenge: { ...challenge, lifecycle: 'cancelled' },
      }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
    );
    show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
    expect(
      screen.getByText('Cancelled. Step sharing has stopped.')
    ).toBeInTheDocument();
    expect(screen.queryByText('54,280')).not.toBeInTheDocument();
  });
  it.each(['Accept invitation', 'Decline'])(
    'allows invitee to %s without showing scores',
    async (label) => {
      h.useChallengeIdentity.mockReturnValue({ actor: peer, enabled: true });
      h.useChallengeDetail.mockReturnValue(
        query({
          ...detail,
          challenge: { ...challenge, my_membership: 'pending' },
          participants: [detail.participants[1]],
        }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
      );
      show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
      expect(screen.queryByText('54,280')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({
          action: label === 'Decline' ? 'decline' : 'accept',
          id: challenge.id,
        })
      );
    }
  );
  it('hides acceptance after invitation closes', () => {
    h.useChallengeIdentity.mockReturnValue({ actor: peer, enabled: true });
    h.useChallengeDetail.mockReturnValue(
      query({
        ...detail,
        challenge: {
          ...challenge,
          lifecycle: 'completed',
          my_membership: 'pending',
        },
      }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
    );
    show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
    expect(
      screen.queryByRole('button', { name: 'Accept invitation' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });
  it.each(['Leave Challenge', 'Cancel Challenge'])(
    'confirms %s before mutation',
    async (label) => {
      if (label === 'Leave Challenge')
        h.useChallengeIdentity.mockReturnValue({ actor: peer, enabled: true });
      show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(mutateAsync).not.toHaveBeenCalled();
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: label })
      );
      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith({
          action: label === 'Leave Challenge' ? 'leave' : 'cancel',
          id: challenge.id,
        })
      );
    }
  );
  it('renames only upcoming Challenges and excludes existing invitees', async () => {
    h.useChallengeDetail.mockReturnValue(
      query({
        ...detail,
        challenge: { ...challenge, lifecycle: 'upcoming' },
      }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
    );
    show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Tomorrow together' },
    });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Rename' })
    );
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'rename',
        id: challenge.id,
        name: 'Tomorrow together',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByText(/No eligible connections/)).toBeInTheDocument();
  });
  it('hides owner actions for other participants', () => {
    h.useChallengeIdentity.mockReturnValue({ actor: peer, enabled: true });
    show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
    expect(
      screen.queryByRole('button', { name: 'Invite' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rename' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel Challenge' })
    ).not.toBeInTheDocument();
  });
});
describe('creation', () => {
  it('validates before submission', () => {
    show(<CreateChallengePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1–100 characters');
    expect(mutateAsync).not.toHaveBeenCalled();
  });
  it('selects a connected friend, uses account timezone and submits steps only', async () => {
    show(<CreateChallengePage />);
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Keep going' },
    });
    fireEvent.click(screen.getByLabelText('Marta'));
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'create',
        body: expect.objectContaining({
          name: 'Keep going',
          timezone: 'Europe/Rome',
          participant_ids: [peer],
          metric: 'steps',
          scoring_mode: 'sum',
        }),
      })
    );
  });
  it('does not offer inactive connections', () => {
    h.useChallengeConnections.mockReturnValue(
      query([{ ...connection, is_active: false }]) as unknown as ReturnType<
        typeof hooks.useChallengeConnections
      >
    );
    show(<CreateChallengePage />);
    expect(screen.queryByLabelText('Marta')).not.toBeInTheDocument();
  });
});
it('keeps your own position on a compact group card', () => {
  const group = {
    ...results,
    entries: Array.from({ length: 4 }, (_, i) => ({
      ...results.entries[0]!,
      user_id: i === 3 ? actor : `${peer}-${i}`,
      display_name: `Friend ${i}`,
      rank: i + 1,
    })),
  };
  show(<ChallengeScores result={group} actor={actor} compact />);
  expect(screen.getByText('Friend 3')).toBeInTheDocument();
  expect(screen.getByText('Rank 4')).toBeInTheDocument();
});
it.each([false, true])(
  'labels reconciled completed winners (tie=%s)',
  (tied) => {
    const result = {
      ...results,
      challenge: { ...challenge, lifecycle: 'completed' as const },
      leader_user_ids: tied ? [actor, peer] : [actor],
    };
    show(<ChallengeScores result={result} actor={actor} />);
    expect(
      screen.getByText(
        tied ? 'Current tied winners: Nico and Marta' : 'Current winner: Nico'
      )
    ).toBeInTheDocument();
  }
);
it('uses singular steps without an unresolved interpolation', () => {
  const result = {
    ...results,
    lead_margin: 1,
    entries: results.entries.map((e) => ({
      ...e,
      daily: [{ date: '2026-10-03', value: 1, present: true, eligible: true }],
    })),
  };
  show(
    <>
      <ChallengeScores result={result} actor={actor} />
      <ChallengeDailyHistory result={result} actor={actor} />
    </>
  );
  expect(screen.getByText('Nico leads by 1 step')).toBeInTheDocument();
  expect(screen.getAllByText('1 step')).toHaveLength(2);
});
it('does not submit invalid calendar ranges', () => {
  show(<CreateChallengePage />);
  fireEvent.change(screen.getByLabelText('Challenge name'), {
    target: { value: 'Together' },
  });
  fireEvent.change(screen.getByLabelText('Start date'), {
    target: { value: '2026-10-09' },
  });
  fireEvent.change(screen.getByLabelText('End date'), {
    target: { value: '2026-10-03' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
it('retains inputs on failed creation', async () => {
  mutateAsync.mockRejectedValueOnce(new Error('offline'));
  show(<CreateChallengePage />);
  fireEvent.change(screen.getByLabelText('Challenge name'), {
    target: { value: 'Keep me' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(screen.getByDisplayValue('Keep me')).toBeInTheDocument();
});
it('invites an eligible connection through the owner dialog', async () => {
  h.useChallengeDetail.mockReturnValue(
    query({
      ...detail,
      participants: detail.participants.slice(0, 1),
    }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
  );
  show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
  fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  fireEvent.click(screen.getByLabelText('Marta'));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Invite' })
  );
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'invite',
      id: challenge.id,
      userId: peer,
    })
  );
});

it('removes selected connections after eligibility changes', () => {
  h.useChallengeConnections.mockReturnValue(
    query([{ ...connection, is_active: false }]) as unknown as ReturnType<
      typeof hooks.useChallengeConnections
    >
  );
  const change = jest.fn();
  show(<ChallengeInvitees selected={[peer]} onChange={change} />);
  expect(change).toHaveBeenCalledWith([]);
});
it('hides personal Challenge content in delegated profile context', () => {
  const switchToUser = jest.fn();
  jest.mocked(useActiveUser).mockReturnValue({
    isActingOnBehalf: true,
    switchToUser,
  } as unknown as ReturnType<typeof useActiveUser>);
  show(<ChallengesPage />);
  expect(screen.queryByText(challenge.name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Use my profile'));
  expect(switchToUser).toHaveBeenCalledWith(null);
});

describe('Workout time presentation', () => {
  it('creates a workout-time competition while keeping Steps the default', async () => {
    show(<CreateChallengePage />);
    expect(screen.getByRole('radio', { name: 'Steps' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Workout time' }));
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Time together' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'create',
        body: expect.objectContaining({
          metric: 'workout_time',
          scoring_mode: 'sum',
        }),
      })
    );
  });
  it.each(['active', 'completed'] as const)(
    'renders %s versus duration, margin and secondary counts',
    (lifecycle) => {
      show(
        <ChallengeScores
          actor={actor}
          result={{
            ...workoutResults,
            challenge: { ...workoutResults.challenge, lifecycle },
          }}
        />
      );
      expect(screen.getAllByText('3h 42m').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/4 workouts/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/24m/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/54,280/)).not.toBeInTheDocument();
    }
  );
  it('renders group server ranks and ties without treating counts as tiebreakers', () => {
    const entries = [
      ...workoutResults.entries,
      {
        ...workoutResults.entries[0]!,
        user_id: third,
        display_name: 'Luca',
        rank: 1,
        is_tied: true,
        total_workout_count: 1,
      },
    ];
    show(
      <ChallengeScores actor={actor} result={{ ...workoutResults, entries }} />
    );
    expect(screen.getByText('Luca')).toBeInTheDocument();
    expect(screen.getByText('1 workout')).toBeInTheDocument();
  });
  it('distinguishes qualifying zero duration from no workout recorded in daily history', () => {
    show(<ChallengeDailyHistory actor={actor} result={workoutResults} />);
    expect(screen.getAllByText('0m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No workout recorded').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText('No step data')).not.toBeInTheDocument();
  });
  it('shows a workout invitation without score disclosure', () => {
    h.useChallenges.mockReturnValue({
      ...query({
        pages: [
          {
            challenges: [
              { ...workoutResults.challenge, my_membership: 'pending' },
            ],
          },
        ],
      }),
    } as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />);
    expect(screen.getAllByText(/Workout time/).length).toBeGreaterThan(0);
    expect(screen.queryByText('3h 42m')).not.toBeInTheDocument();
  });
});

describe('Rematch', () => {
  it.each(['completed', 'cancelled'] as const)(
    'offers an editable rematch for %s',
    (lifecycle) => {
      h.useChallengeDetail.mockReturnValue(
        query({
          ...detail,
          challenge: { ...challenge, lifecycle },
        }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
      );
      show(<ChallengeDetailPage />, `/challenges/${challenge.id}`);
      expect(screen.getByRole('link', { name: 'Rematch' })).toHaveAttribute(
        'href',
        `/challenges/new?rematch=${challenge.id}`
      );
    }
  );
  it('prefills Workout Time and eligible friends, then uses ordinary create', async () => {
    h.useChallengeDetail.mockReturnValue(
      query({
        ...detail,
        challenge: {
          ...challenge,
          metric: 'workout_time',
          lifecycle: 'completed',
        },
      }) as unknown as ReturnType<typeof hooks.useChallengeDetail>
    );
    show(<CreateChallengePage />, `/challenges/new?rematch=${challenge.id}`);
    expect(screen.getByRole('radio', { name: 'Workout time' })).toBeChecked();
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Another round' },
    });
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'create',
        body: expect.objectContaining({
          name: 'Another round',
          metric: 'workout_time',
          participant_ids: [peer],
        }),
      })
    );
  });
});
