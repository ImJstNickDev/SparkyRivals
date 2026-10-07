import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import {
  type ChallengeDetailResponse,
  challengeDayState,
  challengeDayComparison,
} from '@workspace/shared';
import { ChallengeTargetForm } from '@/pages/Challenges/ChallengeTargetForm';
import { ChallengeResultSummary } from '@/pages/Challenges/ChallengeResultSummary';
import { WaterAndExerciseFields } from '@/pages/Goals/WaterAndExerciseFields';
import { DEFAULT_GOALS } from '@/constants/goals';
import * as hooks from '@/hooks/Challenges/useChallenges';
import english from '../../../public/locales/en/translation.json';
import italian from '../../../public/locales/it/translation.json';
import {
  actor,
  peer,
  detail,
  goalResults,
  results,
} from '../fixtures/challenges';

jest.mock('@/hooks/Challenges/useChallenges');
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({
    timezone: 'Europe/Rome',
    distanceUnit: 'km',
    energyUnit: 'kcal',
    water_display_unit: 'ml',
  }),
}));
const h = jest.mocked(hooks);
const mutateAsync = jest.fn();
const lobby: ChallengeDetailResponse = {
  challenge: {
    ...detail.challenge,
    lifecycle: 'lobby',
    scoring_mode: 'goal_progress',
    start_date: null,
    end_date: null,
    duration_days: 7,
    locked_at: null,
  },
  participants: detail.participants.map((p) => ({
    ...p,
    target_value: null,
    target_revision: 0,
    ready_at: null,
  })),
};
function saved(target = 9000, revision = 1): ChallengeDetailResponse {
  return {
    ...lobby,
    participants: lobby.participants.map((p) =>
      p.user_id === actor
        ? { ...p, target_value: target, target_revision: revision }
        : p
    ),
  };
}
function setup(ui: React.ReactNode, language = 'en') {
  const i18n = createInstance();
  void i18n.init({
    lng: language,
    fallbackLng: 'en',
    resources: { en: { translation: english }, it: { translation: italian } },
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/lobby',
        element: (
          <>
            <Link to="/hub">Back to hub</Link>
            {ui}
          </>
        ),
      },
      { path: '/hub', element: <h1>Hub destination</h1> },
    ],
    { initialEntries: ['/hub', '/lobby'], initialIndex: 1 }
  );
  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nextProvider>
    ),
    router,
    i18n,
  };
}
function targetForm(data = lobby, suggested = 8000) {
  return (
    <ChallengeTargetForm
      detail={data}
      own={data.participants[0]!}
      suggested={suggested}
    />
  );
}
const input = () => screen.getByLabelText('Your daily target (steps)');
beforeEach(() => {
  jest.clearAllMocks();
  h.useChallengeIdentity.mockReturnValue({ actor, enabled: true });
  h.useChallengeMutation.mockReturnValue({
    mutateAsync,
    mutate: mutateAsync,
    reset: jest.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof hooks.useChallengeMutation>);
  mutateAsync.mockResolvedValue(saved());
});

it('does not save a suggested target until an explicit edit or Ready', () => {
  setup(targetForm());
  expect(input()).toHaveValue('8000');
  fireEvent.blur(input());
  expect(mutateAsync).not.toHaveBeenCalled();
  expect(screen.queryByText('Save target')).not.toBeInTheDocument();
});
it('saves on blur once and Ready uses the returned revision', async () => {
  let resolve!: (value: ChallengeDetailResponse) => void;
  mutateAsync.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  setup(targetForm());
  fireEvent.change(input(), { target: { value: '9000' } });
  fireEvent.blur(input());
  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  await act(async () => resolve(saved(9000, 7)));
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      action: 'ready',
      id: lobby.challenge.id,
      ready: true,
      revision: 7,
    })
  );
  expect(mutateAsync).toHaveBeenCalledTimes(2);
});
it('keeps a saved target but explains when Ready fails', async () => {
  mutateAsync
    .mockResolvedValueOnce(saved(8000, 3))
    .mockRejectedValueOnce(new Error('offline'));
  setup(targetForm());
  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  expect(
    await screen.findByText(/Target saved. Ready was not confirmed./)
  ).toHaveAttribute('role', 'alert');
  expect(mutateAsync.mock.calls[1][0].revision).toBe(3);
});
it('does not call Ready after the target request fails', async () => {
  mutateAsync.mockRejectedValue(new Error('revision conflict'));
  setup(targetForm());
  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  await screen.findByRole('alert');
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  expect(input()).toHaveValue('8000');
});
it('rejects malformed localized input without writing', () => {
  setup(targetForm());
  fireEvent.change(input(), { target: { value: '1,2,3' } });
  fireEvent.blur(input());
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(mutateAsync).not.toHaveBeenCalled();
});
it('Italian input accepts a decimal comma and language changes preserve the draft', async () => {
  const context = setup(targetForm(), 'it');
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: '9000,5' } });
  await act(() => context.i18n.changeLanguage('en'));
  expect(input()).toHaveValue('9000,5');
  fireEvent.blur(input());
  expect(mutateAsync).toHaveBeenCalledWith({
    action: 'target',
    id: lobby.challenge.id,
    target: 9000.5,
    revision: 0,
  });
});
it('browser Back waits for target persistence', async () => {
  let resolve!: (value: ChallengeDetailResponse) => void;
  mutateAsync.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const context = setup(targetForm());
  fireEvent.change(input(), { target: { value: '9000' } });
  await act(() => context.router.navigate(-1));
  expect(screen.queryByText('Hub destination')).not.toBeInTheDocument();
  await act(async () => resolve(saved()));
  expect(await screen.findByText('Hub destination')).toBeInTheDocument();
});
it('failed Back save stays on the editor with the entered value', async () => {
  mutateAsync.mockRejectedValue(new Error('offline'));
  setup(targetForm());
  fireEvent.change(input(), { target: { value: '9000' } });
  fireEvent.click(screen.getByText('Back to hub'));
  await screen.findByRole('alert');
  expect(input()).toHaveValue('9000');
  expect(screen.queryByText('Hub destination')).not.toBeInTheDocument();
});
it('does not confirm Ready after identity changes during target saving', async () => {
  let resolve!: (value: ChallengeDetailResponse) => void;
  mutateAsync.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const Test = () => {
    const identity = hooks.useChallengeIdentity();
    return identity.actor === actor ? targetForm() : <p>Another account</p>;
  };
  const context = setup(<Test />);
  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  h.useChallengeIdentity.mockReturnValue({ actor: peer, enabled: true });
  await act(() => context.router.revalidate());
  // Rerender with the same router/provider so the authenticated destination unmounts.
  context.rerender(
    <I18nextProvider i18n={context.i18n}>
      <RouterProvider router={context.router} key="account-change" />
    </I18nextProvider>
  );
  await act(async () => resolve(saved(8000)));
  expect(mutateAsync).toHaveBeenCalledTimes(1);
});
it.each([50, 100, 140, 200])(
  'shows %s percent without capping server points',
  (score) => {
    const data = {
      ...goalResults,
      entries: goalResults.entries.map((e, index) => ({
        ...e,
        total_score: score,
        total_score_scaled: String(score * 1_000_000),
        today: { ...e.today!, value: score, progress_points: score },
        rank: index + 1,
        is_tied: false,
      })),
    };
    setup(<ChallengeResultSummary result={data} actor={actor} />);
    expect(screen.getByText(`Today ${score}%`)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: `${score}% of your daily target` })
    ).toBeInTheDocument();
    expect(data.entries[0]!.total_score).toBe(score);
  }
);
it('truncates close scores while keeping distinct exact server ranks', () => {
  const data = {
    ...goalResults,
    entries: goalResults.entries.map((e, i) => ({
      ...e,
      total_score: i ? 140.001 : 140.002,
      total_score_scaled: i ? '140001000' : '140002000',
      rank: i + 1,
      is_tied: false,
    })),
  };
  setup(<ChallengeResultSummary result={data} actor={actor} />);
  expect(
    screen.getByRole('button', { name: /Nico, rank 1, 140/ })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Marta, rank 2, 140/ })
  ).toBeInTheDocument();
  expect(screen.queryByText('Tied')).not.toBeInTheDocument();
});
it('a row toggles points to the matching canonical activity with localized units', () => {
  setup(<ChallengeResultSummary result={goalResults} actor={actor} />);
  const row = screen.getByRole('button', { name: /Nico, rank 1/ });
  fireEvent.click(row);
  expect(within(row).getByText('11,200 steps')).toBeInTheDocument();
  fireEvent.click(row);
  expect(within(row).getByText('140')).toBeInTheDocument();
});
it('distinguishes explicit zero, missing, future and reached days', () => {
  const point = results.entries[0]!.daily[1]!;
  expect(challengeDayState(point)).toBe('present');
  expect(challengeDayState({ ...point, present: false })).toBe('missing');
  expect(challengeDayState({ ...point, eligible: false })).toBe('future');
  expect(challengeDayState({ ...point, goal_reached: true })).toBe('reached');
  expect(challengeDayState({ ...point, goal_reached: false })).toBe(
    'notReached'
  );
  expect(
    challengeDayComparison(
      { ...point, score_scaled: '140001' },
      { ...point, score_scaled: '140000' }
    )
  ).toBe('first');
  expect(
    challengeDayComparison(point, { ...point, present: false })
  ).toBeNull();
});
it('Italian personal goals preserve nutrition and refuse malformed input', () => {
  const onChange = jest.fn();
  const valid = jest.fn();
  setup(
    <WaterAndExerciseFields
      state={{ ...DEFAULT_GOALS, calories: 2123, steps_goal: null }}
      setState={onChange}
      onValidityChange={valid}
    />,
    'it'
  );
  const distance = screen.getByLabelText(/Distanza.*km/);
  fireEvent.change(distance, { target: { value: '2,5' } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ calories: 2123, distance_goal_meters: 2500 })
  );
  const count = onChange.mock.calls.length;
  fireEvent.change(distance, { target: { value: '2,5,0' } });
  expect(onChange).toHaveBeenCalledTimes(count);
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(distance).toHaveAttribute('aria-invalid', 'true');
});
