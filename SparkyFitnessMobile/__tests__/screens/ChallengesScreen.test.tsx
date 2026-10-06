import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScreenHeader } from '../../src/hooks/useScreenHeader';
import { fetchDailyGoals } from '../../src/services/api/goalsApi';
import {
  ChallengeResultSummary,
  ChallengeResultSummary as ChallengeScores,
} from '../../src/components/challenges/ChallengeResultSummary';
import { ChallengeLobby } from '../../src/components/challenges/ChallengeLobby';
import i18n from '../../src/localization/i18n';
import english from '../../src/localization/locales/en/translation.json';
import React from 'react';
import { invalidateCompanionChallengeSession } from '../../src/services/companionChallengeSession';
import { Alert, Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
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
  ChallengeDailyHistory,
  ChallengeResultFacts,
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
  goalResults,
  connection,
} from '../helpers/challenges';

jest.mock('../../src/hooks/useChallenges');
jest.mock('../../src/services/api/goalsApi');
jest.mock('../../src/hooks/usePreferences');
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: jest.fn(() => null),
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
const mockDispatch = jest.fn();
let mockRemovalGuard: {
  enabled: boolean;
  callback: (event: { data: { action: { type: string } } }) => void;
};
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (
    enabled: boolean,
    callback: typeof mockRemovalGuard.callback
  ) => {
    mockRemovalGuard = { enabled, callback };
  },
}));
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
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {element}
      </QueryClientProvider>
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
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mutateAsync.mockResolvedValue(detail);
  refresh.mockResolvedValue(undefined);
  h.useChallengeIdentity.mockReturnValue({
    actor,
    enabled: true,
    isLoading: false,
    isError: false,
    refetch,
  } as unknown as ReturnType<typeof hooks.useChallengeIdentity>);
  jest
    .mocked(fetchDailyGoals)
    .mockResolvedValue({ steps_goal: 8000 } as Awaited<
      ReturnType<typeof fetchDailyGoals>
    >);
  setList([challenge]);
  setDetail(detail);
  setResults(results);
  h.useChallengeConnections.mockReturnValue(
    query([connection]) as ReturnType<typeof hooks.useChallengeConnections>
  );
  h.useChallengeMutation.mockReturnValue({
    mutateAsync,
    mutate: mutateAsync,
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
it('requests the selected server collection and keeps rows free of score queries', () => {
  setList([challenge]);
  const view = screen('Challenges');
  expect(h.useChallenges).toHaveBeenLastCalledWith('mine');
  expect(h.useChallengeResults).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('tab', { name: 'Invitations' }));
  expect(h.useChallenges).toHaveBeenLastCalledWith('invitations');
  fireEvent.press(view.getByRole('tab', { name: 'History' }));
  expect(h.useChallenges).toHaveBeenLastCalledWith('history');
  fireEvent.press(view.getByRole('button', { name: `Open ${challenge.name}` }));
  expect(nav.navigate).toHaveBeenCalledWith('ChallengeDetail', {
    id: challenge.id,
  });
});
it('opens creation from the shared header', () => {
  screen('Challenges');
  const config = jest.mocked(useScreenHeader).mock.calls.at(-1)?.[0];
  const action = config?.right;
  expect(action).toMatchObject({
    kind: 'primary',
    label: 'Create',
    disabled: false,
  });
  if (action && !Array.isArray(action) && 'onPress' in action)
    act(() => action.onPress());
  expect(nav.navigate).toHaveBeenCalledWith('CreateChallenge');
});
it('refreshes the entire Challenge domain on pull', async () => {
  const view = screen('Challenges');
  await act(async () => view.getByTestId('challenge-list').props.onRefresh());
  expect(refresh).toHaveBeenCalledTimes(1);
});
it('shows an empty hub', () => {
  setList([]);
  const view = screen('Challenges');
  expect(view.getByText('Your Challenges will appear here.')).toBeTruthy();
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
it('renders authoritative versus totals, ranks and distinct missing/zero points', () => {
  const view = screen('ChallengeDetail');
  expect(view.getByTestId('challenge-scroll')).toHaveStyle({ flex: 1 });
  expect(view.getByText('54,280')).toBeTruthy();
  expect(view.getByText('51,993 steps')).toBeTruthy();
  expect(view.getByText('2')).toBeTruthy();
  expect(view.queryByText('Not started')).toBeNull();
  fireEvent.press(view.getByText('Daily history'));
  expect(view.getByText('0 steps')).toBeTruthy();
  expect(view.getAllByText('No data recorded').length).toBeGreaterThan(0);
  expect(view.getAllByText('Not started').length).toBeGreaterThan(0);
});
it.each([
  'steps',
  'distance',
  'active_calories',
  'workout_time',
  'workout_calories',
  'workout_distance',
  'hydration',
] as const)(
  'describes leaving %s without promising a different metric is shared',
  (metric) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = display(
      <ChallengeActions
        detail={{
          ...detail,
          challenge: { ...challenge, metric, creator_user_id: peer },
        }}
        onDepart={jest.fn()}
      />
    );
    fireEvent.press(view.getByText('Leave Challenge'));
    expect(alert.mock.calls[0]?.[1]).toBe(
      'Leave this Challenge? Your results will be removed and you cannot rejoin.'
    );
    expect(mutateAsync).not.toHaveBeenCalled();
    alert.mockRestore();
  }
);
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
  expect(view.getAllByText('Tied')).toHaveLength(2);
  expect(view.getAllByText('1')).toHaveLength(2);
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
  expect(view.getByText('3')).toBeTruthy();
  fireEvent.press(view.getByText('Daily history'));
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
  expect(view.getByText('Your total')).toBeTruthy();
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
          'Results can change when canonical data arrives late, is corrected or deleted. Locked targets stay unchanged.'
        )
      ).toBeTruthy();
    if (state === 'cancelled') {
      expect(view.queryByText('54,280')).toBeNull();
      expect(view.queryByText('Cancel Challenge')).toBeNull();
    }
    if (state === 'upcoming') {
      expect(view.queryByText('Rename')).toBeNull();
      fireEvent.press(view.getByText('Details and actions'));
      expect(view.getByText('Rename')).toBeTruthy();
    }
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
  expect(view.getByText('What you share')).toBeTruthy();
  expect(view.getByText('Steps')).toBeTruthy();
  expect(view.getByText('Other health data stays private.')).toBeTruthy();
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
  await waitFor(() =>
    expect(nav.replace).toHaveBeenCalledWith('ChallengeDetail', {
      id: challenge.id,
    })
  );
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
  expect(view.getAllByText('1 step')).toHaveLength(2);
});
it('keeps your supplied position visible in the ranked list', () => {
  const group = {
    ...results,
    entries: Array.from({ length: 4 }, (_, i) => ({
      ...results.entries[0]!,
      user_id: i === 3 ? actor : String(i),
      display_name: `Friend ${i}`,
      rank: i + 1,
    })),
  };
  const view = display(<ChallengeScores result={group} actor={actor} />);
  expect(view.getByText('Friend 3 (you)')).toBeTruthy();
  expect(view.getByText('4')).toBeTruthy();
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
    const view = display(<ChallengeScores result={result} actor={actor} />);
    expect(view.getAllByText('1')).toHaveLength(tied ? 2 : 1);
    expect(view.queryAllByText('Tied')).toHaveLength(tied ? 2 : 0);
  }
);

describe('Workout time', () => {
  it('selects the workout metric on creation', async () => {
    const view = screen('CreateChallenge');
    fireEvent.press(view.getByLabelText('Workout time'));
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
      expect(view.getAllByText('3.7').length).toBeGreaterThan(0);
      expect(view.getAllByText(/4 workouts/).length).toBeGreaterThan(0);
      expect(view.getAllByText(/h/).length).toBeGreaterThan(0);
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
      <ChallengeResultFacts result={{ ...workoutResults, entries }} />
    );
    expect(view.getByText('Luca')).toBeTruthy();
    expect(view.getByText('1 workout')).toBeTruthy();
  });
  it('distinguishes missing workout data and present zero in history', () => {
    const view = display(
      <ChallengeDailyHistory actor={actor} result={workoutResults} />
    );
    expect(view.getAllByText('0 min').length).toBeGreaterThan(0);
    expect(view.getAllByText('No workout recorded').length).toBeGreaterThan(0);
    expect(view.queryByText('No step data')).toBeNull();
  });
  it('shows a workout invitation without totals', () => {
    setList([{ ...workoutResults.challenge, my_membership: 'pending' }]);
    const view = screen('Challenges');
    expect(view.getAllByText('Workout Minutes').length).toBeGreaterThan(0);
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

describe('Goal Challenge functional flows', () => {
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
  it('creates a duration-based goal lobby with immediate start as default', async () => {
    const view = screen('CreateChallenge');
    fireEvent.press(view.getByRole('tab', { name: 'Goal points' }));
    fireEvent.changeText(view.getByLabelText('Challenge name'), 'Our goal');
    expect(view.getByLabelText('Start on next full day').props.value).toBe(
      false
    );
    fireEvent.press(view.getByText('Create Challenge'));
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
  it('suggests the personal goal but sends only the chosen self target with a revision', async () => {
    const view = display(<ChallengeLobby detail={lobby} />);
    await waitFor(() =>
      expect(view.getByLabelText('Your daily target (steps)').props.value).toBe(
        '8000'
      )
    );
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.changeText(
      view.getByLabelText('Your daily target (steps)'),
      '9000'
    );
    fireEvent(view.getByLabelText('Your daily target (steps)'), 'blur');
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'target',
      id: challenge.id,
      target: 9000,
      revision: 0,
    });
  });
  it('requires a target when no personal goal exists', async () => {
    jest
      .mocked(fetchDailyGoals)
      .mockResolvedValue({} as Awaited<ReturnType<typeof fetchDailyGoals>>);
    const view = display(<ChallengeLobby detail={lobby} />);
    await waitFor(() =>
      expect(view.getByLabelText('Your daily target (steps)')).toBeTruthy()
    );
    fireEvent.press(view.getByText('Ready'));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(view.getByRole('alert')).toBeTruthy();
  });
  it.each([false, true])(
    'confirms Ready/unready intent when ready=%s',
    async (ready) => {
      const value = {
        ...lobby,
        participants: lobby.participants.map((p) => ({
          ...p,
          target_value: 8000,
          target_revision: 2,
          ready_at: ready ? '2026-10-04T12:00:00Z' : null,
        })),
      };
      const view = display(<ChallengeLobby detail={value} />);
      await waitFor(() =>
        expect(
          view.getByRole('button', {
            name: ready ? 'Not ready' : 'Ready',
          })
        ).toBeTruthy()
      );
      fireEvent.press(
        view.getByRole('button', {
          name: ready ? 'Not ready' : 'Ready',
        })
      );
      await waitFor(() =>
        expect(mutateAsync).toHaveBeenCalledWith(
          ready
            ? { action: 'ready', id: challenge.id, ready: false, revision: 2 }
            : { action: 'ready', id: challenge.id, ready: true, revision: 2 }
        )
      );
    }
  );
  it('confirms creator withdrawal for a pending participant', async () => {
    const value = {
      ...lobby,
      participants: lobby.participants.map((p) =>
        p.user_id === peer ? { ...p, status: 'pending' as const } : p
      ),
    };
    const view = display(<ChallengeLobby detail={value} />);
    fireEvent.press(view.getByText('Delete'));
    expect(mutateAsync).not.toHaveBeenCalled();
    const options = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    options?.find((option) => option.style === 'destructive')?.onPress?.();
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'withdraw',
      id: challenge.id,
      userId: peer,
    });
  });
  const saved = (value: number, revision: number) => ({
    ...lobby,
    participants: lobby.participants.map((p) =>
      p.user_id === actor
        ? { ...p, target_value: value, target_revision: revision }
        : p
    ),
  });
  it('serializes blur and Ready and uses the returned target revision', async () => {
    let finish!: (d: ChallengeDetailResponse) => void;
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise<ChallengeDetailResponse>((resolve) => {
          finish = resolve;
        })
    );
    const view = display(<ChallengeLobby detail={lobby} />);
    const field = await view.findByLabelText('Your daily target (steps)');
    fireEvent.changeText(field, '9000');
    fireEvent(field, 'blur');
    fireEvent.press(view.getByText('Ready'));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    await act(async () => finish(saved(9000, 7)));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenLastCalledWith({
        action: 'ready',
        id: challenge.id,
        ready: true,
        revision: 7,
      })
    );
  });
  it('saves a dirty draft before dispatching Back, without becoming Ready', async () => {
    let finish!: (d: ChallengeDetailResponse) => void;
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise<ChallengeDetailResponse>((resolve) => {
          finish = resolve;
        })
    );
    const view = display(<ChallengeLobby detail={lobby} />);
    fireEvent.changeText(
      await view.findByLabelText('Your daily target (steps)'),
      '9500'
    );
    expect(mockRemovalGuard.enabled).toBe(true);
    act(() =>
      mockRemovalGuard.callback({ data: { action: { type: 'GO_BACK' } } })
    );
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(async () => finish(saved(9500, 1)));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });
  it('retains invalid or failed autosave input and does not leave', async () => {
    const view = display(<ChallengeLobby detail={lobby} />);
    const field = await view.findByLabelText('Your daily target (steps)');
    fireEvent.changeText(field, 'invalid');
    act(() =>
      mockRemovalGuard.callback({ data: { action: { type: 'GO_BACK' } } })
    );
    expect(mutateAsync).not.toHaveBeenCalled();
    mutateAsync.mockRejectedValueOnce(new Error('offline'));
    fireEvent.changeText(field, '9000');
    fireEvent(field, 'blur');
    await waitFor(() =>
      expect(view.getAllByRole('alert').length).toBeGreaterThan(0)
    );
    expect(view.getByDisplayValue('9000')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
  it('does not navigate or issue Ready after a session changes during save', async () => {
    let finish!: (d: ChallengeDetailResponse) => void;
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise<ChallengeDetailResponse>((resolve) => {
          finish = resolve;
        })
    );
    const view = display(<ChallengeLobby detail={lobby} />);
    fireEvent.changeText(
      await view.findByLabelText('Your daily target (steps)'),
      '9000'
    );
    fireEvent.press(view.getByText('Ready'));
    invalidateCompanionChallengeSession(false);
    await act(async () => finish(saved(9000, 1)));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
  it('reports that target saved when the subsequent Ready request fails', async () => {
    mutateAsync
      .mockResolvedValueOnce(saved(9000, 1))
      .mockRejectedValueOnce(new Error('offline'));
    const view = display(<ChallengeLobby detail={lobby} />);
    fireEvent.changeText(
      await view.findByLabelText('Your daily target (steps)'),
      '9000'
    );
    fireEvent.press(view.getByText('Ready'));
    expect(
      await view.findByText(
        'Target saved. Ready was not confirmed. Review the saved target and try again.'
      )
    ).toBeTruthy();
  });
  it('shows locked targets without mutation controls', () => {
    const value = {
      ...lobby,
      challenge: {
        ...lobby.challenge,
        lifecycle: 'active' as const,
        locked_at: '2026-10-04T12:00:00Z',
      },
      participants: lobby.participants.map((p) => ({
        ...p,
        target_value: 8000,
      })),
    };
    const view = display(<ChallengeLobby detail={value} />);
    expect(view.getByText('Locked daily targets')).toBeTruthy();
    expect(view.queryByText('Save target')).toBeNull();
  });
});

describe('Goal result units', () => {
  it('shows uncapped points and each participant target without inventing a tiebreak', () => {
    const view = display(
      <>
        <ChallengeScores actor={actor} result={goalResults} />
        <ChallengeResultFacts result={goalResults} />
      </>
    );
    expect(view.getAllByText('140').length).toBeGreaterThanOrEqual(2);
    expect(view.getByText('Daily target: 8,000 steps')).toBeTruthy();
    expect(view.getByText('Daily target: 16,000 steps')).toBeTruthy();
    expect(view.getAllByText('1')).toHaveLength(2);
    expect(view.getAllByText('Tied')).toHaveLength(2);
  });
  it('keeps canonical actuals and percentage in daily history', () => {
    const view = display(
      <ChallengeDailyHistory actor={actor} result={goalResults} />
    );
    expect(
      view.getAllByText(/11,200.*8,000 steps.*140%/).length
    ).toBeGreaterThan(0);
    expect(view.getAllByText('No data recorded').length).toBeGreaterThan(0);
  });
});

describe('Goal result visual summary', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [100, '100th'],
  ] as const)(
    'groups the total with the server-supplied %s place',
    (rank, ordinal) => {
      const result = {
        ...goalResults,
        entries: Array.from({ length: Math.max(2, rank) }, (_, index) => ({
          ...goalResults.entries[0]!,
          user_id: index === rank - 1 ? actor : `synthetic-${index}`,
          rank: index + 1,
          is_tied: false,
        })),
      };
      const view = display(
        <ChallengeResultSummary actor={actor} result={result} />
      );
      const card = within(view.getByTestId('challenge-own-result'));
      expect(card.getByText('Your total')).toBeTruthy();
      expect(card.getByText('points')).toBeTruthy();
      expect(
        card.getByText(`${ordinal} place · ${result.entries.length} players`)
      ).toBeTruthy();
      expect(card.queryByText('Today 140%')).toBeNull();
      expect(view.getByText('Today 140%')).toBeTruthy();
    }
  );
  it('keeps a true server tie explicit in the summary card', () => {
    const view = display(
      <ChallengeResultSummary actor={actor} result={goalResults} />
    );
    expect(view.getByText('Joint 1st place · 2 players')).toBeTruthy();
  });
  it('uses a singular player count and omits position when unranked', () => {
    const entry = { ...goalResults.entries[0]!, rank: 1, is_tied: false };
    const view = display(
      <ChallengeResultSummary
        actor={actor}
        result={{ ...goalResults, entries: [entry] }}
      />
    );
    expect(view.getByText('1st place · 1 player')).toBeTruthy();
    view.unmount();
    const unranked = display(
      <ChallengeResultSummary
        actor={actor}
        result={{ ...goalResults, entries: [{ ...entry, rank: null }] }}
      />
    );
    expect(
      within(unranked.getByTestId('challenge-own-result')).queryByText(/place/)
    ).toBeNull();
  });
  it('keeps the centered freshness label last, including after expanding details', () => {
    setDetail({ ...detail, challenge: goalResults.challenge });
    setResults(goalResults);
    const view = screen('ChallengeDetail');
    const expectFooterLast = () => {
      const footer = view.getByText(/^Updated /);
      expect(footer.props.className).toContain('text-center');
      const texts = view.getByTestId('challenge-scroll').findAllByType(Text);
      expect(texts.at(-1)?.props.children).toBe(footer.props.children);
    };
    expectFooterLast();
    fireEvent.press(view.getByText('Details and actions'));
    expect(view.getByText(goalResults.challenge.timezone)).toBeTruthy();
    expectFooterLast();
  });
  it.each([50, 100, 140, 200])(
    'presents %s points without capping or duplicating units',
    (points) => {
      const result = {
        ...goalResults,
        entries: goalResults.entries.map((e) => ({
          ...e,
          total_score: points,
          total_score_scaled: String(points * 1_000_000),
        })),
      };
      const view = display(
        <ChallengeResultSummary actor={actor} result={result} />
      );
      expect(view.getAllByText(String(points)).length).toBeGreaterThan(0);
      expect(view.getByText('points')).toBeTruthy();
      expect(view.queryByText(`${points} pts`)).toBeNull();
    }
  );
  it('preserves distinct server ranks when presentation rounds values alike', () => {
    const result = {
      ...goalResults,
      entries: goalResults.entries.map((e, i) => ({
        ...e,
        total_score: 140.000002 - i * 0.000001,
        total_score_scaled: String(140000002 - i),
        rank: i + 1,
        is_tied: false,
      })),
    };
    const view = display(
      <ChallengeResultSummary actor={actor} result={result} />
    );
    expect(view.getByText('1')).toBeTruthy();
    expect(view.getByText('2')).toBeTruthy();
    expect(view.queryByText('Tied')).toBeNull();
    expect(view.queryByText('Exact values')).toBeNull();
    fireEvent.press(view.getByLabelText(/Nico, rank 1/));
    expect(view.getByText('11,200 steps')).toBeTruthy();
    expect(view.getByText('2')).toBeTruthy();
  });
});
