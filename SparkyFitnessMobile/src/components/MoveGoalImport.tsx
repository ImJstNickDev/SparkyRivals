import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { readAppleMoveGoal } from '../../modules/move-goal';
import { useAppLocale } from '../localization';
import Button from './ui/Button';

/** Reading never writes a personal goal or overwrites the current form value. */
export function MoveGoalImport({
  onUse,
  disabled = false,
}: {
  onUse: (kcal: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const mounted = useRef(true);
  const reading = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [value, setValue] = useState<number | null>(null);
  if (Platform.OS !== 'ios') return null;
  const read = async () => {
    if (reading.current || disabled) return;
    reading.current = true;
    setBusy(true);
    try {
      const goal = await readAppleMoveGoal();
      if (mounted.current) setValue(goal);
    } catch {
      if (mounted.current) setValue(null);
    } finally {
      reading.current = false;
      if (mounted.current) {
        setAttempted(true);
        setBusy(false);
      }
    }
  };
  return (
    <View className="gap-2">
      <Button
        accessibilityRole="button"
        variant="secondary"
        disabled={busy || disabled}
        onPress={() => void read()}
      >
        {t('goals.readMove', { defaultValue: 'Read Apple Move goal' })}
      </Button>
      {value != null && (
        <Button
          accessibilityRole="button"
          variant="secondary"
          disabled={busy || disabled}
          onPress={() => onUse(value)}
        >
          {t('goals.useMove', {
            defaultValue: 'Use {{value}} kcal from Apple Move',
            value: new Intl.NumberFormat(locale, {
              maximumFractionDigits: 2,
            }).format(value),
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
