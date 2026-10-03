import Constants from 'expo-constants';
import { getAppScheme, getAppUrl } from '../../src/utils/appLinks';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: undefined },
}));

it.each([
  'sparkyfitnessmobile',
  'sparkyrivals-dev',
  'sparkyrivals-preview',
  'sparkyrivals',
])('uses the built %s scheme', (scheme) => {
  jest.replaceProperty(Constants, 'expoConfig', {
    name: 'fixture',
    slug: 'fixture',
    scheme,
  });
  expect(getAppScheme()).toBe(scheme);
  expect(getAppUrl()).toBe(`${scheme}://`);
  expect(getAppUrl('active-workout')).toBe(`${scheme}://active-workout`);
});

it('supports primary-scheme arrays and older upstream manifests', () => {
  jest.replaceProperty(Constants, 'expoConfig', {
    name: 'fixture',
    slug: 'fixture',
    scheme: ['sparkyrivals', 'secondary'],
  });
  expect(getAppScheme()).toBe('sparkyrivals');
  jest.replaceProperty(Constants, 'expoConfig', undefined);
  expect(getAppScheme()).toBe('sparkyfitnessmobile');
});

afterEach(() => jest.restoreAllMocks());
