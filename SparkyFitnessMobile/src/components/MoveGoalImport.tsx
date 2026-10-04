import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { readAppleMoveGoal } from '../../modules/move-goal';
import Button from './ui/Button';

/** Reading never writes a personal goal or overwrites the current form value. */
export function MoveGoalImport({ onUse }: { onUse: (kcal: number) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  if (Platform.OS !== 'ios') return null;
  const read = async () => {
    setBusy(true);
    try {
      setValue(await readAppleMoveGoal());
    } catch {
      setValue(null);
    } finally {
      setAttempted(true);
      setBusy(false);
    }
  };
  return (
    <View className="gap-2">
      <Text className="text-text-secondary">
        {t('goals.moveExplanation', {
          defaultValue:
            'You can import today’s Apple Fitness Move goal. Apple Health may ask for Activity Summary access. Your saved goal changes only after you choose Use and Save.',
        })}
      </Text>
      <Button
        accessibilityRole="button"
        variant="secondary"
        disabled={busy}
        onPress={() => void read()}
      >
        {t('goals.readMove', { defaultValue: 'Read Apple Move goal' })}
      </Button>
      {value != null && (
        <Button
          accessibilityRole="button"
          variant="secondary"
          disabled={busy}
          onPress={() => onUse(value)}
        >
          {t('goals.useMove', {
            defaultValue: 'Use {{value}} kcal from Apple Move',
            value,
          })}
        </Button>
      )}
      {attempted && value == null && !busy && (
        <Text accessibilityRole="text" className="text-text-secondary">
          {t('goals.moveUnavailable', {
            defaultValue:
              'Apple Move goal unavailable. You can enter your own active-calorie goal.',
          })}
        </Text>
      )}
    </View>
  );
}
