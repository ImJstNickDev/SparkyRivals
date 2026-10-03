import { ExtensionStorage } from '@bacons/apple-targets';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { CalorieWidgetBridge } from './CalorieWidgetBridge';
import type { buildChallengeWidget } from '../utils/challengeSurface';

/** Called serially after the same account barrier used by both companions. */
export async function publishChallengeWidget(
  snapshot: ReturnType<typeof buildChallengeWidget>
) {
  if (Platform.OS === 'ios') {
    const group: unknown = Constants.expoConfig?.extra?.iosAppGroup;
    if (typeof group !== 'string' || !group) return;
    new ExtensionStorage(group).set('challengeWidgetSnapshot', snapshot);
    ExtensionStorage.reloadWidget('challengeWidget');
  } else if (Platform.OS === 'android') {
    await CalorieWidgetBridge.setChallengeSnapshot(JSON.stringify(snapshot));
  }
}
