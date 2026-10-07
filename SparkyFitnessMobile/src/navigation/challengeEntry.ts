import {
  CommonActions,
  type NavigationContainerRef,
  type NavigationState,
} from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export function openChallengeEntry(
  navigation: NavigationContainerRef<RootStackParamList>,
  id?: string
) {
  if (!navigation.isReady()) return;
  // Container dispatch callbacks receive the deepest focused navigator's state
  // (tabs, or the iOS tab-local stack), not the root stack that owns Challenges.
  // Read the root explicitly and dispatch an already targeted action.
  const state = navigation.getRootState();
  if (state) navigation.dispatch(challengeEntryAction(state, id));
}

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
