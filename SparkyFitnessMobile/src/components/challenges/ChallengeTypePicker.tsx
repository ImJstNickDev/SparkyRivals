import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  CHALLENGE_TYPES,
  type ChallengeMetric,
  type ChallengeScoringMode,
} from '@workspace/shared';
import BottomSheetPicker from '../BottomSheetPicker';
import SegmentedControl from '../SegmentedControl';
import { challengeMetricText } from '@workspace/shared';

export function ChallengeTypePicker({
  metric,
  mode,
  disabled,
  onChange,
}: {
  metric: ChallengeMetric;
  mode: ChallengeScoringMode;
  disabled?: boolean;
  onChange: (metric: ChallengeMetric, mode: ChallengeScoringMode) => void;
}) {
  const { t } = useTranslation();
  const groups = {
    movement: t('challenges.groups.movement', { defaultValue: 'Movement' }),
    workout: t('challenges.groups.workout', { defaultValue: 'Workout' }),
    hydration: t('challenges.groups.hydration', { defaultValue: 'Hydration' }),
  };
  const modes = {
    sum: t('challenges.modes.total', { defaultValue: 'Total' }),
    goal_progress: t('challenges.modes.points', {
      defaultValue: 'Goal points',
    }),
    goal_days: t('challenges.modes.days', { defaultValue: 'Goal days' }),
  };
  return (
    <View
      className="gap-3"
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityState={{ disabled }}
    >
      <Text className="text-text-primary font-semibold">
        {t('challenges.chooseMetric', { defaultValue: 'What will you track?' })}
      </Text>
      <BottomSheetPicker
        title={t('challenges.chooseMetric', {
          defaultValue: 'What will you track?',
        })}
        value={metric}
        containerStyle={{ minHeight: 48 }}
        sections={(['movement', 'workout', 'hydration'] as const).map(
          (group) => ({
            title: groups[group],
            options: [
              ...new Set(
                CHALLENGE_TYPES.filter((type) => type.group === group).map(
                  (type) => type.metric
                )
              ),
            ].map((value) => ({ value, label: challengeMetricText(t, value) })),
          })
        )}
        onSelect={(next) => {
          if (disabled) return;
          const allowed = CHALLENGE_TYPES.filter(
            (type) => type.metric === next
          );
          onChange(
            next,
            allowed.find((type) => type.scoring_mode === mode)?.scoring_mode ??
              allowed[0].scoring_mode
          );
        }}
      />
      <SegmentedControl
        segments={CHALLENGE_TYPES.filter((type) => type.metric === metric).map(
          (type) => ({
            key: type.scoring_mode,
            label: modes[type.scoring_mode],
          })
        )}
        activeKey={mode}
        onSelect={(next) => {
          if (!disabled) onChange(metric, next);
        }}
      />
      <Text className="text-text-secondary text-sm">
        {mode === 'sum'
          ? t('challenges.modes.totalHint', {
              defaultValue: 'Compare accumulated totals.',
            })
          : mode === 'goal_progress'
            ? t('challenges.modes.pointsHint', {
                defaultValue: '100% earns 100 points. Going beyond earns more.',
              })
            : t('challenges.modes.daysHint', {
                defaultValue:
                  'Count days you reach your target. They need not be consecutive.',
              })}
      </Text>
    </View>
  );
}
