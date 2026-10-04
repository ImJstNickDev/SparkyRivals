import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { TFunction } from 'i18next';

/** Challenge alerts have no action buttons. Android uses its channel; Expo's
 * Android category API rejects an empty action list. iOS permits that category. */
export async function prepareChallengeNotificationDelivery(t: TFunction) {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('challenges', {
      name: t('challenges.title', { defaultValue: 'Challenges' }),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  else if (Platform.OS === 'ios')
    await Notifications.setNotificationCategoryAsync('challenge', []);
}
