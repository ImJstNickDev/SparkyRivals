import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PersonalGoalsScreen from '../../src/screens/PersonalGoalsScreen';
import { useChallengeIdentity } from '../../src/hooks/useChallenges';
import { usePreferences } from '../../src/hooks/usePreferences';
import {
  fetchDailyGoals,
  saveDailyGoals,
} from '../../src/services/api/goalsApi';
import { invalidateCompanionChallengeSession } from '../../src/services/companionChallengeSession';
import type { DailyGoals } from '../../src/types/goals';
import i18n from '../../src/localization/i18n';
import english from '../../src/localization/locales/en/translation.json';
import italian from '../../src/localization/locales/it/translation.json';
import Toast from 'react-native-toast-message';

jest.mock('../../src/hooks/useChallenges');
jest.mock('../../src/hooks/usePreferences');
jest.mock('../../src/services/api/goalsApi');
jest.mock('../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: jest.fn(() => null),
}));
jest.mock('../../src/services/nativeTabBarPreference', () => ({
  useNativeIOSHeadersActive: () => false,
}));
jest.mock('../../src/components/ActiveWorkoutBar', () => ({
  useActiveWorkoutBarPadding: () => 0,
}));
jest.mock('../../src/components/MoveGoalImport', () => ({
  MoveGoalImport: () => null,
}));
jest.mock('../../src/components/CalendarSheet', () => ({
  __esModule: true,
  default: () => null,
}));
const mockNavigation = { goBack: jest.fn(), dispatch: jest.fn() };
let mockGuard: {
  enabled: boolean;
  callback: (event: { data: { action: { type: string } } }) => void;
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (enabled: boolean, callback: typeof mockGuard.callback) => {
    mockGuard = { enabled, callback };
  },
}));
const goals: DailyGoals = {
  calories: 2000,
  protein: 110,
  carbs: 210,
  fat: 60,
  dietary_fiber: 25,
  steps_goal: 8000,
  active_calories_goal: 500,
  water_goal_ml: 1920,
};
const api = jest.mocked(saveDailyGoals);
let resolveSave: () => void;
let rejectSave: (error: Error) => void;
beforeEach(async () => {
  jest.clearAllMocks();
  invalidateCompanionChallengeSession(false);
  i18n.addResourceBundle('en', 'translation', english, true, true);
  i18n.addResourceBundle('it', 'translation', italian, true, true);
  await i18n.changeLanguage('en');
  jest.mocked(useChallengeIdentity).mockReturnValue({
    actor: 'synthetic',
    enabled: true,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  jest.mocked(usePreferences).mockReturnValue({
    preferences: { timezone: 'Europe/Rome' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  });
  jest.mocked(fetchDailyGoals).mockResolvedValue(goals);
  api.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        resolveSave = resolve;
        rejectSave = reject;
      })
  );
});
afterEach(async () => {
  await i18n.changeLanguage('en');
});
const display = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const screen = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <QueryClientProvider client={client}>
        <PersonalGoalsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
  return { screen, client };
};
it('saves comma input, preserves nutrition, collapses repeated presses and returns only after acknowledgment', async () => {
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily distance')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily distance'), '1,5');
  fireEvent.press(screen.getByLabelText('Save'));
  fireEvent.press(screen.getByLabelText('Saving…'));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(api.mock.calls[0][1]).toEqual({
    ...goals,
    distance_goal_meters: 1500,
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  await act(async () => resolveSave());
  await waitFor(() => expect(mockNavigation.goBack).toHaveBeenCalledTimes(1));
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text1: 'Goals saved' })
  );
});
it('retains failed edits and stays on the editor', async () => {
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily steps')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '9500');
  fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(api).toHaveBeenCalled());
  await act(async () => rejectSave(new Error('offline')));
  expect(screen.getByDisplayValue('9500')).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByText('Could not save goals. Try again.')).toBeTruthy()
  );
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
});
it('uses one removal guard for Back and swipes, and never silently saves on back', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily steps')).toBeTruthy()
  );
  expect(mockGuard.enabled).toBe(false);
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '9500');
  expect(mockGuard.enabled).toBe(true);
  act(() => mockGuard.callback({ data: { action: { type: 'GO_BACK' } } }));
  expect(api).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)?.[2];
  act(() => buttons?.find((button) => button.style === 'cancel')?.onPress?.());
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  act(() => mockGuard.callback({ data: { action: { type: 'GO_BACK' } } }));
  act(() =>
    alert.mock.calls
      .at(-1)?.[2]
      ?.find((button) => button.style === 'destructive')
      ?.onPress?.()
  );
  expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  alert.mockRestore();
});
it('restoring the unchanged value permits ordinary Back', async () => {
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily steps')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '9500');
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '8000');
  expect(mockGuard.enabled).toBe(false);
});
it('rejects malformed input without sending a request', async () => {
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily steps')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '1,2,3');
  fireEvent.press(screen.getByLabelText('Save'));
  expect(api).not.toHaveBeenCalled();
  expect(
    screen.getByText('Use positive numbers or leave a goal blank.')
  ).toBeTruthy();
});
it('keeps a draft through language and query changes and translates mounted labels', async () => {
  const { screen, client } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily distance')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily distance'), '2,75');
  await act(async () => {
    await i18n.changeLanguage('it');
  });
  expect(screen.getByLabelText('Distanza giornaliera')).toBeTruthy();
  expect(screen.getByDisplayValue('2,75')).toBeTruthy();
  act(() => {
    client.setQueriesData({ queryKey: ['goals'] }, { ...goals, protein: 130 });
  });
  expect(screen.getByDisplayValue('2,75')).toBeTruthy();
});
it('ignores a late successful response after account/server invalidation', async () => {
  const { screen } = display();
  await waitFor(() =>
    expect(screen.getByLabelText('Daily steps')).toBeTruthy()
  );
  fireEvent.changeText(screen.getByLabelText('Daily steps'), '9500');
  fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(api).toHaveBeenCalled());
  act(() => invalidateCompanionChallengeSession(true));
  await act(async () => resolveSave());
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(Toast.show).not.toHaveBeenCalled();
  expect(screen.queryByDisplayValue('9500')).toBeNull();
});
