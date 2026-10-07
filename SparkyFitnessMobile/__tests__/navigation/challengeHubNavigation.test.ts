import { CommonActions, StackRouter } from '@react-navigation/native';
import { challengeEntryAction } from '../../src/navigation/challengeEntry';

const options = {
  routeNames: ['Tabs', 'Challenges', 'ChallengeDetail'],
  routeParamList: {},
  routeGetIdList: {},
};
const router = StackRouter({ initialRouteName: 'Tabs' });
const initial = () => router.getInitialState(options);

it('opens the hub when no unique active Challenge is supplied', () => {
  const state = initial();
  const next = router.getStateForAction(
    state,
    challengeEntryAction(state),
    options
  );
  expect(next?.routes.map(({ name }) => name)).toEqual(['Tabs', 'Challenges']);
  expect(next?.routes[0]).toBe(state.routes[0]);
});

it('builds Dashboard -> hub -> detail and Back visits the hub before the Dashboard', () => {
  const state = initial();
  const detail = router.getStateForAction(
    state,
    challengeEntryAction(state, 'fixture'),
    options
  );
  expect(detail?.routes.map(({ name }) => name)).toEqual([
    'Tabs',
    'Challenges',
    'ChallengeDetail',
  ]);
  expect(detail?.routes[0]).toBe(state.routes[0]);
  expect(detail?.routes[2].params).toEqual({ id: 'fixture' });
  if (!detail) throw new Error('Expected detail');
  const hub = router.getStateForAction(detail, CommonActions.goBack(), options);
  expect(hub?.routes.map(({ name }) => name)).toEqual(['Tabs', 'Challenges']);
  if (!hub) throw new Error('Expected hub');
  const dashboard = router.getStateForAction(
    hub,
    CommonActions.goBack(),
    options
  );
  expect(dashboard?.routes).toEqual(state.routes);
});

it('preserves an existing hub route and does not duplicate it', () => {
  const start = initial();
  const state = router.getStateForAction(
    start,
    challengeEntryAction(start),
    options
  );
  if (!state) throw new Error('Expected hub');
  const next = router.getStateForAction(
    state,
    challengeEntryAction(state, 'fixture'),
    options
  );
  expect(next?.routes.map(({ name }) => name)).toEqual([
    'Tabs',
    'Challenges',
    'ChallengeDetail',
  ]);
  expect(next?.routes[1].key).toBe(state.routes[1].key);
});
