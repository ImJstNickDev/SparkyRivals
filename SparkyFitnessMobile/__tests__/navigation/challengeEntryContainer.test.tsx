import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { openChallengeEntry } from '../../src/navigation/challengeEntry';
import type { RootStackParamList } from '../../src/types/navigation';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<{ Dashboard: undefined }>();
const DashboardStack = createNativeStackNavigator<{
  DashboardRoot: undefined;
}>();

describe.each([false, true])(
  'container entry with tab-local stack: %s',
  (nested) => {
    it.each([undefined, 'fixture'])(
      'opens the root Challenge route for %s',
      async (id) => {
        const navigation = createNavigationContainerRef<RootStackParamList>();
        const onUnhandledAction = jest.fn();
        function Dashboard() {
          return (
            <Pressable onPress={() => openChallengeEntry(navigation, id)}>
              <Text>Open Challenges</Text>
            </Pressable>
          );
        }
        function DashboardTab() {
          return nested ? (
            <DashboardStack.Navigator>
              <DashboardStack.Screen
                name="DashboardRoot"
                component={Dashboard}
              />
            </DashboardStack.Navigator>
          ) : (
            <Dashboard />
          );
        }
        function TabScreens() {
          return (
            <Tabs.Navigator>
              <Tabs.Screen name="Dashboard" component={DashboardTab} />
            </Tabs.Navigator>
          );
        }
        const view = render(
          <NavigationContainer
            ref={navigation}
            onUnhandledAction={onUnhandledAction}
          >
            <Root.Navigator>
              <Root.Screen name="Tabs" component={TabScreens} />
              <Root.Screen name="Challenges">
                {() => <Text>Challenge hub</Text>}
              </Root.Screen>
              <Root.Screen name="ChallengeDetail">
                {() => <Text>Challenge detail</Text>}
              </Root.Screen>
            </Root.Navigator>
          </NavigationContainer>
        );
        await waitFor(() => expect(navigation.isReady()).toBe(true));
        const originalTabs = navigation.getRootState().routes[0];
        fireEvent.press(view.getByText('Open Challenges'));
        await waitFor(() =>
          expect(navigation.getCurrentRoute()?.name).toBe(
            id ? 'ChallengeDetail' : 'Challenges'
          )
        );
        expect(onUnhandledAction).not.toHaveBeenCalled();
        expect(
          navigation.getRootState().routes.map(({ name }) => name)
        ).toEqual(
          id
            ? ['Tabs', 'Challenges', 'ChallengeDetail']
            : ['Tabs', 'Challenges']
        );
        if (id) {
          expect(navigation.getCurrentRoute()?.params).toEqual({ id });
          act(() => navigation.goBack());
          expect(navigation.getCurrentRoute()?.name).toBe('Challenges');
        }
        act(() => navigation.goBack());
        expect(navigation.getCurrentRoute()?.name).toBe(
          nested ? 'DashboardRoot' : 'Dashboard'
        );
        expect(navigation.getRootState().routes[0]).toEqual(originalTabs);
      }
    );
  }
);

it('does not dispatch before the root container is ready', () => {
  const navigation = createNavigationContainerRef<RootStackParamList>();
  const dispatch = jest.spyOn(navigation, 'dispatch');
  openChallengeEntry(navigation);
  expect(dispatch).not.toHaveBeenCalled();
});
