import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import SettingsRow, { SettingsRowGroup } from '../SettingsRow';
import Switch from '../ui/Switch';
import { useAppPreferencesStore } from '../../stores/appPreferencesStore';
import { requestNotificationPermission } from '../../services/notifications';

export function ChallengeNotificationSettings() {
  const { t } = useTranslation();
  const preferences = useAppPreferencesStore((s) => s.challengeNotifications);
  const set = useAppPreferencesStore((s) => s.setChallengeNotifications);
  const labels = {
    enabled: t('challenges.notifications.enabled', {
      defaultValue: 'Challenge notifications',
    }),
    invitations: t('challenges.notifications.invitations', {
      defaultValue: 'New invitations',
    }),
    start: t('challenges.notifications.start', {
      defaultValue: 'Challenge starts',
    }),
    endingSoon: t('challenges.notifications.endingSoon', {
      defaultValue: 'Ending soon',
    }),
    ended: t('challenges.notifications.ended', {
      defaultValue: 'Challenge ends',
    }),
    leadChanges: t('challenges.notifications.leadChanges', {
      defaultValue: 'Lead changes',
    }),
  };
  return (
    <SettingsRowGroup title={labels.enabled}>
      <Text className="px-4 py-2 text-text-secondary">
        {t('challenges.notifications.hint', {
          defaultValue:
            'Alerts use results refreshed on this phone. Lead changes are checked when the app refreshes.',
        })}
      </Text>
      {(Object.keys(labels) as (keyof typeof labels)[])
        .filter((key) => key === 'enabled' || preferences.enabled)
        .map((key) => (
          <SettingsRow
            key={key}
            title={labels[key]}
            rightAccessory={
              <Switch
                accessibilityLabel={labels[key]}
                value={preferences[key]}
                onValueChange={async (value) => {
                  if (
                    value &&
                    (await requestNotificationPermission()) !== 'granted'
                  )
                    return;
                  set({
                    ...useAppPreferencesStore.getState().challengeNotifications,
                    [key]: value,
                  });
                }}
              />
            }
          />
        ))}
    </SettingsRowGroup>
  );
}
