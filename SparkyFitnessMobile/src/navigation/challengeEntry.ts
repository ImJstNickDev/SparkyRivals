import { CommonActions, type NavigationState } from '@react-navigation/native';

/** Keep a real hub route behind the optional single-active shortcut. */
export function challengeEntryAction(state: NavigationState, id?: string) {
  const currentRoutes = state.routes.slice(0, state.index + 1);
  const hubIndex = currentRoutes.findLastIndex(
    (route) => route.name === 'Challenges'
  );
  const routes =
    hubIndex >= 0
      ? currentRoutes.slice(0, hubIndex + 1)
      : [...currentRoutes, { name: 'Challenges' }];
  if (id) routes.push({ name: 'ChallengeDetail', params: { id } });
  return {
    ...CommonActions.reset({ ...state, routes, index: routes.length - 1 }),
    target: state.key,
  };
}
