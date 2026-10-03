import i18n from '../../src/localization/i18n';
import english from '../../src/localization/locales/en/translation.json';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type {
  ChallengeDetailResponse,
  ChallengeLeaderboardResponse,
  ChallengeResponse,
} from '@workspace/shared';
import ChallengesScreen from '../../src/screens/ChallengesScreen';
import ChallengeDetailScreen from '../../src/screens/ChallengeDetailScreen';
import CreateChallengeScreen from '../../src/screens/CreateChallengeScreen';
import ChallengeDashboardEntry from '../../src/components/challenges/ChallengeDashboardEntry';
import { ChallengeActions } from '../../src/components/challenges/ChallengeActions';
import { ChallengeInvitees } from '../../src/components/challenges/ChallengeInvitees';
import {
  ChallengeScores,
  ChallengeDailyHistory,
} from '../../src/components/challenges/ChallengeScores';
import * as hooks from '../../src/hooks/useChallenges';
import { usePreferences } from '../../src/hooks/usePreferences';
import type { RootStackScreenProps } from '../../src/types/navigation';
import {
  actor,
  peer,
  third,
  challenge,
  detail,
  results,
  workoutResults,
  connection,
} from '../helpers/challenges';

jest.mock('../../src/hooks/useChallenges');
jest.mock('../../src/hooks/usePreferences');
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => null,
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));
jest.mock('../../src/components/CalendarSheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { __esModule: true, default: React.forwardRef(() => null) };
});
const h = jest.mocked(hooks);
const nav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};
const mutateAsync = jest.fn();
const refresh = jest.fn();
const refetch = jest.fn();
const query = <T,>(data: T) => ({
  data,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch,
});
const display = (element: React.ReactNode) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      {element}
    </SafeAreaProvider>
  );
const screen = (name: 'Challenges' | 'ChallengeDetail' | 'CreateChallenge') => {
  if (name === 'Challenges')
    return display(
      <ChallengesScreen
        navigation={
          nav as unknown as RootStackScreenProps<'Challenges'>['navigation']
        }
        route={{ key: name, name }}
      />
    );
  if (name === 'ChallengeDetail')
    return display(
      <ChallengeDetailScreen
        navigation={
          nav as unknown as RootStackScreenProps<'ChallengeDetail'>['navigation']
        }
        route={{ key: name, name, params: { id: challenge.id } }}
      />
    );
  return display(
    <CreateChallengeScreen
      navigation={
        nav as unknown as RootStackScreenProps<'CreateChallenge'>['navigation']
      }
      route={{ key: name, name }}
    />
  );
};
function setDetail(value: ChallengeDetailResponse) {
  h.useChallengeDetail.mockReturnValue(
    query(value) as ReturnType<typeof hooks.useChallengeDetail>
  );
}
function setList(items: ChallengeResponse[]) {
  h.useChallenges.mockReturnValue(
    query({
      pages: [{ challenges: items, has_more: false }],
      pageParams: [0],
    }) as unknown as ReturnType<typeof hooks.useChallenges>
  );
}
function setResults(value: ChallengeLeaderboardResponse) {
  h.useChallengeResults.mockReturnValue(
    query(value) as ReturnType<typeof hooks.useChallengeResults>
  );
}
beforeAll(() => {
  i18n.addResourceBundle('en', 'translation', english, true, true);
});
beforeEach(() => {
  jest.clearAllMocks();
  mutateAsync.mockResolvedValue(detail);
  refresh.mockResolvedValue(undefined);
  h.useChallengeIdentity.mockReturnValue({
    actor,
    enabled: true,
    isLoading: false,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof hooks.useChallengeIdentity>);
  setList([challenge]);
  setDetail(detail);
  setResults(results);
  h.useChallengeConnections.mockReturnValue(
    query([connection]) as ReturnType<typeof hooks.useChallengeConnections>
  );
  h.useChallengeMutation.mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
    reset: jest.fn(),
  } as unknown as ReturnType<typeof hooks.useChallengeMutation>);
  h.useChallengeScreenRefresh.mockReturnValue(refresh);
  jest.mocked(usePreferences).mockReturnValue({
    preferences: { timezone: 'Europe/Rome' },
    isLoading: false,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof usePreferences>);
});
it('provides a labelled one-tap Dashboard entry', () => {
  const press = jest.fn();
  const view = display(<ChallengeDashboardEntry onPress={press} />);
  fireEvent.press(view.getByRole('button', { name: 'Challenges' }));
  expect(press).toHaveBeenCalledTimes(1);
});
it('groups invitations, active, upcoming, completed and cancelled without invitation scores', () => {
  setList(
    ['pending', 'active', 'upcoming', 'completed', 'cancelled'].map(
      (state, index) => ({
        ...challenge,
        id: `${challenge.id}-${index}`,
        name: state,
        lifecycle:
          state === 'pending'
            ? 'active'
            : (state as ChallengeResponse['lifecycle']),
        my_membership: state === 'pending' ? 'pending' : 'accepted',
      })
    )
  );
  const view = screen('Challenges');
  expect(view.getByText('Invitations')).toBeTruthy();
  expect(view.getAllByText('Completed')[0]).toBeTruthy();
  expect(view.getByText('Scores are visible after you accept.')).toBeTruthy();
  expect(view.getByText('Cancelled. Step sharing has stopped.')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Open active' }));
  expect(nav.navigate).toHaveBeenCalledWith('ChallengeDetail', {
    id: `${challenge.id}-1`,
  });
});
it('opens creation from the hub', () => {
  const view = screen('Challenges');
  fireEvent.press(view.getByText('Create Challenge'));
  expect(nav.navigate).toHaveBeenCalledWith('CreateChallenge');
});
it('refreshes the entire Challenge domain on pull', async () => {
  const view = screen('Challenges');
  await act(async () =>
    view.getByTestId('challenge-scroll').props.refreshControl.props.onRefresh()
  );
  expect(refresh).toHaveBeenCalledTimes(1);
});
it('shows an empty hub', () => {
  setList([]);
  const view = screen('Challenges');
  expect(view.getByText('Go a little further, together')).toBeTruthy();
});
it('shows loading and retryable errors', () => {
  h.useChallenges.mockReturnValue({
    ...query(undefined),
    isPending: true,
  } as unknown as ReturnType<typeof hooks.useChallenges>);
  const view = screen('Challenges');
  expect(view.getByText('Loading Challenges')).toBeTruthy();
  view.unmount();
  h.useChallenges.mockReturnValue({
    ...query(undefined),
    isError: true,
  } as unknown as ReturnType<typeof hooks.useChallenges>);
  const failed = screen('Challenges');
  fireEvent.press(failed.getByText('Try again'));
  expect(refetch).toHaveBeenCalledTimes(1);
});
it('does not allow creation before account identity resolves', () => {
  h.useChallengeIdentity.mockReturnValue({
    actor: '',
    enabled: false,
    isLoading: true,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof hooks.useChallengeIdentity>);
  expect(screen('Challenges').queryByText('Create Challenge')).toBeNull();
});
it('renders authoritative versus totals, ranks, gap and distinct missing/zero points', () => {
  const view = screen('ChallengeDetail');
  expect(view.getByText('54,280')).toBeTruthy();
  expect(view.getByText('51,993')).toBeTruthy();
  expect(view.getByText('Nico leads by 2,287 steps')).toBeTruthy();
  expect(view.getByText('Rank 2')).toBeTruthy();
  expect(view.getByText('0 steps')).toBeTruthy();
  expect(view.getAllByText('No step data').length).toBeGreaterThan(0);
  expect(view.getAllByText('Not started').length).toBeGreaterThan(0);
});
it('uses server rank and tie fields without recalculation', () => {
  setResults({
    ...results,
    lead_margin: 0,
    leader_user_ids: [actor, peer],
    entries: results.entries.map((e) => ({
      ...e,
      rank: 1,
      is_tied: true,
      gap_to_leader: 0,
    })),
  });
  const view = screen('ChallengeDetail');
  expect(view.getByText('Nico, Marta share the lead')).toBeTruthy();
  expect(view.getAllByText(/Rank 1/)).toHaveLength(2);
});
it('supports a group leaderboard and participant history picker', () => {
  setResults({
    ...results,
    entries: [
      ...results.entries,
      { ...results.entries[1]!, user_id: third, display_name: 'Alex', rank: 3 },
    ],
  });
  const view = screen('ChallengeDetail');
  expect(view.getAllByText('Alex')[0]).toBeTruthy();
  expect(view.getByText('Rank 3')).toBeTruthy();
  expect(view.getByLabelText('Participant')).toBeTruthy();
});
it('bounds large participant rendering with show more', () => {
  const many = {
    ...results,
    entries: Array.from({ length: 100 }, (_, i) => ({
      ...results.entries[0]!,
      user_id: String(i),
      display_name: `Friend ${i}`,
      rank: i + 1,
    })),
  };
  const view = display(<ChallengeScores result={many} actor={actor} />);
  expect(view.queryByText('Friend 20')).toBeNull();
  fireEvent.press(view.getByText('Show more participants'));
  expect(view.getByText('Friend 20')).toBeTruthy();
});
it('renders a single competitor without an invented gap', () => {
  const view = display(
    <ChallengeScores
      result={{
        ...results,
        entries: results.entries.slice(0, 1),
        lead_margin: null,
      }}
      actor={actor}
    />
  );
  expect(view.getByText('Your next step starts here')).toBeTruthy();
  expect(view.queryByText(/leads by/)).toBeNull();
});
it.each(['completed', 'cancelled', 'upcoming'] as const)(
  'renders %s lifecycle',
  (state) => {
    setDetail({ ...detail, challenge: { ...challenge, lifecycle: state } });
    const view = screen('ChallengeDetail');
    if (state === 'completed')
      expect(
        view.getByText(
          'Results can change when step data arrives late or is corrected.'
        )
      ).toBeTruthy();
    if (state === 'cancelled') {
      expect(view.queryByText('54,280')).toBeNull();
      expect(view.queryByText('Cancel Challenge')).toBeNull();
    }
    if (state === 'upcoming') expect(view.getByText('Rename')).toBeTruthy();
  }
);
it('withholds stale scores from pending members and shows consent', () => {
  setDetail({
    ...detail,
    challenge: {
      ...challenge,
      creator_user_id: peer,
      my_membership: 'pending',
    },
    participants: [],
  });
  const view = screen('ChallengeDetail');
  expect(view.queryByText('54,280')).toBeNull();
  expect(view.getByText(/Accept to share your daily step totals/)).toBeTruthy();
  expect(view.getByText('Invited by Marta')).toBeTruthy();
});
it.each(['accept', 'decline'] as const)(
  'supports invitation %s',
  async (action) => {
    const departure = jest.fn();
    const pending = {
      ...detail,
      challenge: {
        ...challenge,
        creator_user_id: peer,
        my_membership: 'pending' as const,
      },
    };
    const view = display(
      <ChallengeActions detail={pending} onDepart={departure} />
    );
    fireEvent.press(
      view.getByText(action === 'accept' ? 'Accept invitation' : 'Decline')
    );
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ action, id: challenge.id })
    );
    if (action === 'decline')
      await waitFor(() => expect(departure).toHaveBeenCalled());
  }
);
it('hides acceptance for a closed invitation', () => {
  const pending = {
    ...detail,
    challenge: {
      ...challenge,
      creator_user_id: peer,
      lifecycle: 'completed' as const,
      my_membership: 'pending' as const,
    },
  };
  const view = display(
    <ChallengeActions detail={pending} onDepart={jest.fn()} />
  );
  expect(view.queryByText('Accept invitation')).toBeNull();
  expect(view.getByText('Decline')).toBeTruthy();
});
it.each(['leave', 'cancel'] as const)(
  'confirms %s before mutation',
  async (action) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const value =
      action === 'leave'
        ? { ...detail, challenge: { ...challenge, creator_user_id: peer } }
        : detail;
    const view = display(
      <ChallengeActions detail={value} onDepart={jest.fn()} />
    );
    fireEvent.press(
      view.getByText(
        action === 'leave' ? 'Leave Challenge' : 'Cancel Challenge'
      )
    );
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
    await act(async () => alert.mock.calls[0]![2]![1]!.onPress!());
    expect(mutateAsync).toHaveBeenCalledWith({ action, id: challenge.id });
    alert.mockRestore();
  }
);
it('restricts owner actions and allows rename only before start', async () => {
  const view = display(
    <ChallengeActions
      detail={{ ...detail, challenge: { ...challenge, lifecycle: 'upcoming' } }}
      onDepart={jest.fn()}
    />
  );
  expect(view.queryByText('Leave Challenge')).toBeNull();
  fireEvent.press(view.getByText('Rename'));
  fireEvent.changeText(view.getByLabelText('Challenge name'), 'A fresh start');
  fireEvent.press(view.getAllByText('Rename').at(-1)!);
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'rename',
      id: challenge.id,
      name: 'A fresh start',
    })
  );
});
it('lets the owner invite an eligible connection once', async () => {
  const view = display(
    <ChallengeActions
      detail={{ ...detail, participants: detail.participants.slice(0, 1) }}
      onDepart={jest.fn()}
    />
  );
  fireEvent.press(view.getByText('Invite'));
  fireEvent.press(view.getByRole('checkbox', { name: 'Marta' }));
  fireEvent.press(view.getAllByText('Invite').at(-1)!);
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'invite',
      id: challenge.id,
      userId: peer,
    })
  );
});
it('excludes previous members and disables capacity overflow', () => {
  const view = display(
    <ChallengeInvitees selected={[]} onChange={jest.fn()} excluded={[peer]} />
  );
  expect(view.queryByRole('checkbox')).toBeNull();
  view.unmount();
  const full = display(
    <ChallengeInvitees selected={[]} onChange={jest.fn()} capacity={0} />
  );
  expect(full.getByRole('checkbox').props.accessibilityState.disabled).toBe(
    true
  );
});
it('drops selected invitees when the relationship is no longer eligible', () => {
  h.useChallengeConnections.mockReturnValue(
    query([{ ...connection, is_active: false }]) as ReturnType<
      typeof hooks.useChallengeConnections
    >
  );
  const change = jest.fn();
  display(<ChallengeInvitees selected={[peer]} onChange={change} />);
  expect(change).toHaveBeenCalledWith([]);
});
it('creates in the account timezone with selected Family & Friends', async () => {
  const view = screen('CreateChallenge');
  fireEvent.changeText(view.getByLabelText('Challenge name'), 'Together');
  fireEvent.press(view.getByRole('checkbox', { name: 'Marta' }));
  fireEvent.press(view.getByText('Create Challenge'));
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'create',
      body: expect.objectContaining({
        name: 'Together',
        timezone: 'Europe/Rome',
        participant_ids: [peer],
        metric: 'steps',
        scoring_mode: 'sum',
      }),
    })
  );
  expect(nav.replace).toHaveBeenCalledWith('ChallengeDetail', {
    id: challenge.id,
  });
});
it('validates the creation form and timezone without crashing', () => {
  const view = screen('CreateChallenge');
  fireEvent.press(view.getByText('Create Challenge'));
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(view.getByRole('alert')).toBeTruthy();
  fireEvent.press(view.getByText('Timezone & daily totals'));
  fireEvent.changeText(
    view.getByLabelText('Challenge timezone'),
    'Invalid/Zone'
  );
  fireEvent.changeText(view.getByLabelText('Challenge name'), 'Together');
  fireEvent.press(view.getByText('Create Challenge'));
  expect(mutateAsync).not.toHaveBeenCalled();
});
it('supports the single-day preset', async () => {
  const view = screen('CreateChallenge');
  fireEvent.press(view.getByText('Today'));
  fireEvent.changeText(view.getByLabelText('Challenge name'), 'Today together');
  fireEvent.press(view.getByText('Create Challenge'));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  const body = mutateAsync.mock.calls[0]![0].body;
  expect(body.start_date).toBe(body.end_date);
});
it('preserves typed input after a failed create and does not navigate', async () => {
  mutateAsync.mockRejectedValue(new Error('offline'));
  const view = screen('CreateChallenge');
  fireEvent.changeText(view.getByLabelText('Challenge name'), 'Keep me');
  fireEvent.press(view.getByText('Create Challenge'));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(view.getByDisplayValue('Keep me')).toBeTruthy();
  expect(nav.replace).not.toHaveBeenCalled();
});
it('shows a mutation error without claiming success', () => {
  h.useChallengeMutation.mockReturnValue({
    mutateAsync,
    isError: true,
    isPending: false,
    reset: jest.fn(),
  } as unknown as ReturnType<typeof hooks.useChallengeMutation>);
  expect(screen('CreateChallenge').getByRole('alert')).toBeTruthy();
});
it('marks tied days only when both canonical points are present', () => {
  const tied = {
    ...results,
    entries: results.entries.map((e) => ({
      ...e,
      daily: [{ date: '2026-10-03', value: 0, present: true, eligible: true }],
    })),
  };
  const view = display(<ChallengeDailyHistory result={tied} actor={actor} />);
  expect(view.getByText('Tied day')).toBeTruthy();
});
it('paginates long daily histories', () => {
  const long = {
    ...results,
    entries: results.entries.map((e) => ({
      ...e,
      daily: Array.from({ length: 14 }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        value: i,
        present: true,
        eligible: true,
      })),
    })),
  };
  const view = display(<ChallengeDailyHistory result={long} actor={actor} />);
  expect(view.getByText('2 / 2')).toBeTruthy();
  fireEvent.press(view.getByText('Earlier days'));
  expect(view.getByText('1 / 2')).toBeTruthy();
});

it('uses English singular forms without leaking placeholders', () => {
  const result = {
    ...results,
    lead_margin: 1,
    entries: results.entries.map((e) => ({
      ...e,
      daily: [{ date: '2026-10-03', value: 1, present: true, eligible: true }],
    })),
  };
  const view = display(
    <>
      <ChallengeScores result={result} actor={actor} />
      <ChallengeDailyHistory result={result} actor={actor} />
    </>
  );
  expect(view.getByText('Nico leads by 1 step')).toBeTruthy();
  expect(view.getAllByText('1 step')).toHaveLength(2);
});
it('keeps your position visible below the compact top three', () => {
  const group = {
    ...results,
    entries: Array.from({ length: 4 }, (_, i) => ({
      ...results.entries[0]!,
      user_id: i === 3 ? actor : String(i),
      display_name: `Friend ${i}`,
      rank: i + 1,
    })),
  };
  const view = display(
    <ChallengeScores result={group} actor={actor} compact />
  );
  expect(view.getByText('Friend 3 (you)')).toBeTruthy();
  expect(view.getByText('Rank 4')).toBeTruthy();
});
it.each([false, true])('labels completed current winners (tie=%s)', (tied) => {
  const result = {
    ...results,
    challenge: { ...challenge, lifecycle: 'completed' as const },
    leader_user_ids: tied ? [actor, peer] : [actor],
  };
  const view = display(<ChallengeScores result={result} actor={actor} />);
  expect(
    view.getByText(
      tied ? 'Current tied winners: Nico, Marta' : 'Current winner: Nico'
    )
  ).toBeTruthy();
});

describe('Workout time', () => {
  it('selects the workout metric on creation', async () => {
    const view = screen('CreateChallenge');
    fireEvent.press(view.getByText('Workout time'));
    fireEvent.changeText(
      view.getByLabelText('Challenge name'),
      'Time together'
    );
    fireEvent.press(view.getByText('Create Challenge'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        action: 'create',
        body: expect.objectContaining({ metric: 'workout_time' }),
      })
    );
  });
  it.each(['active', 'completed'] as const)(
    'renders %s workout duration and secondary counts',
    (lifecycle) => {
      const view = display(
        <ChallengeScores
          actor={actor}
          result={{
            ...workoutResults,
            challenge: { ...workoutResults.challenge, lifecycle },
          }}
        />
      );
      expect(view.getAllByText('3h 42m').length).toBeGreaterThan(0);
      expect(view.getAllByText(/4 workouts/).length).toBeGreaterThan(0);
      expect(view.getAllByText(/24m/).length).toBeGreaterThan(0);
    }
  );
  it('renders original group ranks and workout counts', () => {
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
    const view = display(
      <ChallengeScores actor={actor} result={{ ...workoutResults, entries }} />
    );
    expect(view.getByText('Luca')).toBeTruthy();
    expect(view.getByText('1 workout')).toBeTruthy();
  });
  it('distinguishes missing workout data and present zero in history', () => {
    const view = display(
      <ChallengeDailyHistory actor={actor} result={workoutResults} />
    );
    expect(view.getAllByText('0m').length).toBeGreaterThan(0);
    expect(view.getAllByText('No workout recorded').length).toBeGreaterThan(0);
    expect(view.queryByText('No step data')).toBeNull();
  });
  it('shows a workout invitation without totals', () => {
    setList([{ ...workoutResults.challenge, my_membership: 'pending' }]);
    const view = screen('Challenges');
    expect(view.getAllByText(/Workout time/).length).toBeGreaterThan(0);
    expect(view.queryByText('3h 42m')).toBeNull();
  });
});

describe('Rematch', () => {
  it.each(['completed', 'cancelled'] as const)(
    'opens an editable draft from %s',
    (lifecycle) => {
      setDetail({ ...detail, challenge: { ...challenge, lifecycle } });
      const view = screen('ChallengeDetail');
      fireEvent.press(view.getByText('Rematch'));
      expect(nav.navigate).toHaveBeenCalledWith('CreateChallenge', {
        rematchId: challenge.id,
      });
    }
  );
  it('prefills workout metric and current friends without auto-submitting', async () => {
    setDetail({
      ...detail,
      challenge: {
        ...challenge,
        lifecycle: 'completed',
        metric: 'workout_time',
      },
    });
    const view = display(
      <CreateChallengeScreen
        navigation={
          nav as unknown as RootStackScreenProps<'CreateChallenge'>['navigation']
        }
        route={{
          key: 'create',
          name: 'CreateChallenge',
          params: { rematchId: challenge.id },
        }}
      />
    );
    expect(
      view.getByText(
        'Review your rematch. Everyone you invite will choose whether to join again.'
      )
    ).toBeTruthy();
    expect(view.getByDisplayValue(challenge.name)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.changeText(
      view.getByDisplayValue(challenge.name),
      'Another round'
    );
    fireEvent.press(view.getByText('Create Challenge'));
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
