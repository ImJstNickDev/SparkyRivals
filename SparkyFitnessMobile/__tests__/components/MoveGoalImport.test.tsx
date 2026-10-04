import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { MoveGoalImport } from '../../src/components/MoveGoalImport';
import { readAppleMoveGoal } from '../../modules/move-goal';
jest.mock('../../modules/move-goal', () => ({ readAppleMoveGoal: jest.fn() }));
const read = jest.mocked(readAppleMoveGoal);
const os = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
});
afterEach(() =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
);
it('never reads at mount or silently replaces a manually chosen target', async () => {
  const onUse = jest.fn();
  read.mockResolvedValue(450);
  const view = render(<MoveGoalImport onUse={onUse} />);
  expect(read).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Read Apple Move goal'));
  await waitFor(() =>
    expect(view.getByText('Use 450 kcal from Apple Move')).toBeTruthy()
  );
  expect(onUse).not.toHaveBeenCalled();
  fireEvent.press(view.getByText('Use 450 kcal from Apple Move'));
  expect(onUse).toHaveBeenCalledWith(450);
});
it('keeps manual entry available on missing data or denied permission', async () => {
  read.mockResolvedValue(null);
  const onUse = jest.fn();
  const view = render(<MoveGoalImport onUse={onUse} />);
  fireEvent.press(view.getByText('Read Apple Move goal'));
  await waitFor(() =>
    expect(view.getByText(/Apple Move goal unavailable/)).toBeTruthy()
  );
  expect(onUse).not.toHaveBeenCalled();
});
it('does not offer Apple import on Android', () => {
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  const view = render(<MoveGoalImport onUse={jest.fn()} />);
  expect(view.toJSON()).toBeNull();
  expect(read).not.toHaveBeenCalled();
});
