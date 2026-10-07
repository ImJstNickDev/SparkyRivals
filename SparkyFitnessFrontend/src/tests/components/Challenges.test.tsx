import { ChallengeResultSummary as ChallengeScores } from '@/pages/Challenges/ChallengeResultSummary';
import { ChallengeLobby } from '@/pages/Challenges/ChallengeLobby';
import { useDailyGoals } from '@/hooks/Goals/useGoals';
import type { ChallengeDetailResponse } from '@workspace/shared';
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
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import english from '../../../public/locales/en/translation.json';
import ChallengesPage from '@/pages/Challenges/ChallengesPage';
import ChallengeDetailPage from '@/pages/Challenges/ChallengeDetailPage';
import CreateChallengePage from '@/pages/Challenges/CreateChallengePage';
import {
  ChallengeResultFacts,
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
  goalResults,
  connection,
} from '../fixtures/challenges';
jest.mock('@/hooks/Challenges/useChallenges');
jest.mock('@/hooks/Goals/useGoals');
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
  const router = createMemoryRouter(
    [
      { path: '/challenges/:id', element: ui },
      { path: '/challenges', element: ui },
    ],
    { initialEntries: [path] }
  );
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  );
}
function openDetails() {
  fireEvent.click(screen.getByText('Challenge details'));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useDailyGoals)
    .mockReturnValue(
      query({ steps_goal: 8000 }) as unknown as ReturnType<typeof useDailyGoals>
    );
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
    mutate: mutateAsync,
    reset: jest.fn(),
    isPending: false,
    isError: false,
  } as unknown as unknown as ReturnType<typeof hooks.useChallengeMutation>);
  mutateAsync.mockResolvedValue(detail);
});
describe('Challenge hub', () => {
  it('requests each complete hub view and does not load row leaderboards', async () => {
    h.useChallenges.mockImplementation(
      (view) =>
        ({
          ...query({
            pages: [
              {
                challenges:
                  view === 'invitations'
                    ? [{ ...challenge, my_membership: 'pending' }]
                    : view === 'history'
                      ? [{ ...challenge, lifecycle: 'completed' }]
                      : [challenge],
              },
            ],
          }),
          hasNextPage: false,
        }) as unknown as ReturnType<typeof hooks.useChallenges>
    );
    show(<ChallengesPage />);
    expect(h.useChallenges).toHaveBeenLastCalledWith('mine');
    expect(screen.getByRole('tab', { name: 'My Challenges' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Invitations' }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() =>
      expect(h.useChallenges).toHaveBeenLastCalledWith('invitations')
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() =>
      expect(h.useChallenges).toHaveBeenLastCalledWith('history')
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(h.useChallengeResults).not.toHaveBeenCalled();
  });
  it('renders an invitation row without displaying scores', () => {
    h.useChallenges.mockReturnValue({
      ...query({
        pages: [{ challenges: [{ ...challenge, my_membership: 'pending' }] }],
      }),
    } as unknown as ReturnType<typeof hooks.useChallenges>);
    show(<ChallengesPage />, '/challenges?view=invitations');
    expect(screen.queryByText('54,280')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /A little further/ })
    ).toBeInTheDocument();
    expect(h.useChallengeResults).not.toHaveBeenCalled();
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
        screen.getByText('Your Challenges will appear here.')
      ).toBeInTheDocument();
  });
});
describe('scores and daily history', () => {
  it('shows server ranks, today, zero and absent days', () => {
    show(
      <>
        <ChallengeScores result={results} actor={actor} />
        <ChallengeDailyHistory result={results} actor={actor} />
      </>
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Today: 0 steps')).toBeInTheDocument();
    expect(screen.getByText('0 steps')).toBeInTheDocument();
    expect(screen.getAllByText('No data recorded').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('Tied')).toHaveLength(2);
    expect(screen.getAllByText('1')).toHaveLength(2);
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
      within(screen.getByRole('list', { name: 'Standings' })).getAllByRole(
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
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getAllByText(/Results can change/).length).toBeGreaterThan(0);
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
      screen.getByText('Cancelled. Challenge data sharing has stopped.')
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
      openDetails();
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
    openDetails();
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
it('keeps your supplied position in the ranked list', () => {
  const group = {
    ...results,
    entries: Array.from({ length: 4 }, (_, i) => ({
      ...results.entries[0]!,
      user_id: i === 3 ? actor : `${peer}-${i}`,
      display_name: `Friend ${i}`,
      rank: i + 1,
    })),
  };
  show(<ChallengeScores result={group} actor={actor} />);
  expect(screen.getByText('Friend 3 (you)')).toBeInTheDocument();
  expect(screen.getByText('4')).toBeInTheDocument();
});
it.each([false, true])(
  'preserves completed server ranks and ties (tie=%s)',
  (tied) => {
    const result = {
      ...results,
      challenge: { ...challenge, lifecycle: 'completed' as const },
      entries: results.entries.map((entry, index) => ({
        ...entry,
        rank: tied ? 1 : index + 1,
        is_tied: tied,
      })),
    };
    show(<ChallengeScores result={result} actor={actor} />);
    expect(screen.getAllByText('1')).toHaveLength(tied ? 2 : 1);
    expect(screen.queryAllByText('Tied')).toHaveLength(tied ? 2 : 0);
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
  openDetails();
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
    expect(
      screen.getByRole('combobox', { name: 'What will you track?' })
    ).toHaveValue('steps');
    fireEvent.change(
      screen.getByRole('combobox', { name: 'What will you track?' }),
      {
        target: { value: 'workout_time' },
      }
    );
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
        <>
          <ChallengeScores
            actor={actor}
            result={{
              ...workoutResults,
              challenge: { ...workoutResults.challenge, lifecycle },
            }}
          />
          <ChallengeResultFacts result={workoutResults} />
        </>
      );
      expect(screen.getAllByText('3.7').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/4 workouts/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/h/).length).toBeGreaterThan(0);
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
      <>
        <ChallengeScores
          actor={actor}
          result={{ ...workoutResults, entries }}
        />
        <ChallengeResultFacts result={{ ...workoutResults, entries }} />
      </>
    );
    expect(screen.getAllByText('Luca').length).toBeGreaterThan(0);
    expect(screen.getByText('1 workout')).toBeInTheDocument();
  });
  it('distinguishes qualifying zero duration from no workout recorded in daily history', () => {
    show(<ChallengeDailyHistory actor={actor} result={workoutResults} />);
    expect(screen.getAllByText('0 min').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No workout recorded').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText('No data recorded')).not.toBeInTheDocument();
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
    show(<ChallengesPage />, '/challenges?view=invitations');
    expect(screen.getAllByText(/Workout Minutes/).length).toBeGreaterThan(0);
    expect(screen.queryByText('3.7')).not.toBeInTheDocument();
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
    expect(
      screen.getByRole('combobox', { name: 'What will you track?' })
    ).toHaveValue('workout_time');
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

describe('Goal lobbies', () => {
  const lobby: ChallengeDetailResponse = {
    ...detail,
    challenge: {
      ...challenge,
      scoring_mode: 'goal_progress',
      lifecycle: 'lobby',
      start_date: null,
      end_date: null,
      duration_days: 7,
      start_next_day: false,
      locked_at: null,
    },
    participants: detail.participants.map((p) => ({
      ...p,
      target_value: null,
      ready_at: null,
      target_revision: 0,
    })),
  };
  it('creates a duration-based goal lobby with immediate start by default', async () => {
    show(<CreateChallengePage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Goal points' }));
    fireEvent.change(screen.getByLabelText('Challenge name'), {
      target: { value: 'Our goal' },
    });
    expect(screen.getByLabelText('Start on next full day')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Create Challenge' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'create',
        body: expect.objectContaining({
          metric: 'steps',
          scoring_mode: 'goal_progress',
          duration_days: 7,
          start_next_day: false,
        }),
      })
    );
    expect(mutateAsync.mock.calls[0][0].body).not.toHaveProperty('start_date');
  });
  it('suggests the personal goal and autosaves an explicit override on blur', async () => {
    show(<ChallengeLobby detail={lobby} />);
    expect(screen.getByLabelText('Your daily target (steps)')).toHaveValue(
      '8000'
    );
    fireEvent.change(screen.getByLabelText('Your daily target (steps)'), {
      target: { value: '9000' },
    });
    fireEvent.blur(screen.getByLabelText('Your daily target (steps)'));
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'target',
      id: challenge.id,
      target: 9000,
      revision: 0,
    });
  });
  it('locks target inputs after activation while keeping targets visible', () => {
    show(
      <ChallengeLobby
        detail={{
          ...lobby,
          challenge: {
            ...lobby.challenge,
            lifecycle: 'active',
            locked_at: '2026-10-04T12:00:00Z',
          },
          participants: lobby.participants.map((p) => ({
            ...p,
            target_value: 8000,
          })),
        }}
      />
    );
    expect(screen.getAllByText('8,000 steps')).toHaveLength(2);
    expect(screen.queryByText('Save target')).not.toBeInTheDocument();
  });
  it('requires confirmation before creator withdraws a pending invitation', async () => {
    show(
      <ChallengeLobby
        detail={{
          ...lobby,
          participants: lobby.participants.map((p) =>
            p.user_id === peer ? { ...p, status: 'pending' } : p
          ),
        }}
      />
    );
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Actions for Marta' }),
      { key: 'Enter' }
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Remove',
      })
    );
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'withdraw',
      id: challenge.id,
      userId: peer,
    });
  });
});

describe('Goal result units', () => {
  it('shows uncapped points, distinct targets and a genuine tie', () => {
    show(
      <>
        <ChallengeScores actor={actor} result={goalResults} />
        <ChallengeResultFacts result={goalResults} />
      </>
    );
    expect(screen.getAllByText('140').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Daily target: 8,000 steps')).toBeInTheDocument();
    expect(screen.getByText('Daily target: 16,000 steps')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getAllByText('Tied')).toHaveLength(2);
  });
  it('keeps canonical actuals and percentage in daily history', () => {
    show(<ChallengeDailyHistory actor={actor} result={goalResults} />);
    expect(
      screen.getAllByText(/11,200.*8,000 steps.*140%/).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('No data recorded').length).toBeGreaterThan(0);
  });
});
