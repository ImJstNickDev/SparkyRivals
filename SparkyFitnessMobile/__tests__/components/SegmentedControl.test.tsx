import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SegmentedControl from '../../src/components/SegmentedControl';

it('keeps every tab operable with an explicit selected state and scalable labels', () => {
  const onSelect = jest.fn();
  const view = render(
    <SegmentedControl
      activeKey="first"
      onSelect={onSelect}
      segments={[
        { key: 'first', label: 'First' },
        { key: 'second', label: 'A longer translated label' },
      ]}
    />
  );
  expect(
    view.getByRole('tab', { name: 'First' }).props.accessibilityState
  ).toEqual({ selected: true });
  const other = view.getByRole('tab', { name: 'A longer translated label' });
  expect(other.props.accessibilityState).toEqual({ selected: false });
  fireEvent.press(other);
  expect(onSelect).toHaveBeenCalledWith('second');
  const label = view.getByText('A longer translated label');
  expect(label.props.className).toContain('text-text-secondary');
  expect(label.props.allowFontScaling).not.toBe(false);
  expect(label.props.numberOfLines).toBeUndefined();
});
