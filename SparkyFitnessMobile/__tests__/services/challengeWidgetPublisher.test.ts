import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';
import Constants from 'expo-constants';
import { publishChallengeWidget } from '../../src/services/challengeWidgetPublisher';
import { CalorieWidgetBridge } from '../../src/services/CalorieWidgetBridge';
import { buildChallengeWidget } from '../../src/utils/challengeSurface';
import { emptyCompanionChallenges } from '../../src/utils/companionChallenges';
import i18n from '../../src/localization/i18n';
const mockSet = jest.fn();
jest.mock('@bacons/apple-targets', () => ({
  ExtensionStorage: Object.assign(
    jest.fn(() => ({ set: mockSet })),
    { reloadWidget: jest.fn() }
  ),
}));
jest.mock('../../src/services/CalorieWidgetBridge', () => ({
  CalorieWidgetBridge: { setChallengeSnapshot: jest.fn() },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { iosAppGroup: 'group.test.shared' } } },
}));
afterEach(() => jest.restoreAllMocks());
beforeEach(() => jest.clearAllMocks());
it('iOS clears only Challenge state and reloads its existing extension kind', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const clear = buildChallengeWidget(emptyCompanionChallenges(), i18n.t, 'en');
  await publishChallengeWidget(clear);
  expect(ExtensionStorage).toHaveBeenCalledWith('group.test.shared');
  expect(mockSet).toHaveBeenCalledWith(
    'challengeWidgetSnapshot',
    JSON.stringify(clear)
  );
  expect(ExtensionStorage.reloadWidget).toHaveBeenCalledWith('challengeWidget');
  expect(CalorieWidgetBridge.setChallengeSnapshot).not.toHaveBeenCalled();
});
it('Android clears via the existing bridge, without an Apple write', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const clear = buildChallengeWidget(emptyCompanionChallenges(), i18n.t, 'en');
  await publishChallengeWidget(clear);
  expect(CalorieWidgetBridge.setChallengeSnapshot).toHaveBeenCalledWith(
    JSON.stringify(clear)
  );
  expect(mockSet).not.toHaveBeenCalled();
});
it('missing configured App Group does not fall back to an upstream group', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.replaceProperty(Constants, 'expoConfig', { name: 'test', slug: 'test' });
  await publishChallengeWidget(
    buildChallengeWidget(emptyCompanionChallenges(), i18n.t, 'en')
  );
  expect(mockSet).not.toHaveBeenCalled();
});
