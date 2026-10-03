import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { useTranslation } from 'react-i18next';
import Icon from '../Icon';

export default function ChallengeDashboardEntry({
  onPress,
}: {
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const accent = useCSSVariable('--color-accent-primary') as string;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('challenges.title', { defaultValue: 'Challenges' })}
      className="mx-4 mb-4 flex-row items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-5"
    >
      <Icon name="trophy" size={28} color={accent} />
      <View className="flex-1 gap-1">
        <Text className="text-text-primary text-lg font-semibold">
          {t('challenges.title', { defaultValue: 'Challenges' })}
        </Text>
        <Text className="text-text-secondary">
          {t('challenges.dashboardHint', {
            defaultValue: 'Move together. Make every step count.',
          })}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={accent} />
    </Pressable>
  );
}
