import { useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

/** Native-stack removal guard: header, hardware Back and interactive swipe share
 * the same decision. A request already sent is never described as cancelled. */
export function useUnsavedFormGuard({
  dirty,
  saving,
  current,
}: {
  dirty: boolean;
  saving: boolean;
  current: () => boolean;
}) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const showing = useRef(false);
  const requestLeave = (leave: () => void) => {
    if (!current()) return;
    if (!dirty && !saving) {
      leave();
      return;
    }
    if (showing.current) return;
    showing.current = true;
    const dismissed = () => {
      showing.current = false;
    };
    if (saving) {
      Alert.alert(
        t('common.saving', { defaultValue: 'Saving…' }),
        t('goals.waitForSave', {
          defaultValue: 'Wait for the save to finish.',
        }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: dismissed }],
        { onDismiss: dismissed }
      );
      return;
    }
    Alert.alert(
      t('goals.discardTitle', { defaultValue: 'Discard unsaved changes?' }),
      undefined,
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
          onPress: dismissed,
        },
        {
          text: t('common.discardChanges', { defaultValue: 'Discard changes' }),
          style: 'destructive',
          onPress: () => {
            dismissed();
            if (current()) leave();
          },
        },
      ],
      { cancelable: true, onDismiss: dismissed }
    );
  };
  usePreventRemove(current() && (dirty || saving), ({ data }) =>
    requestLeave(() => navigation.dispatch(data.action))
  );
  return requestLeave;
}
