import {
  CHALLENGE_TYPES,
  challengeMetricText,
  type ChallengeMetric,
  type ChallengeScoringMode,
} from '@workspace/shared';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function ChallengeTypePicker({
  metric,
  mode,
  onChange,
}: {
  metric: ChallengeMetric;
  mode: ChallengeScoringMode;
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
  const supported = CHALLENGE_TYPES.filter((type) => type.metric === metric);
  return (
    <div className="space-y-3">
      <Label htmlFor="challenge-metric">
        {t('challenges.chooseMetric', { defaultValue: 'What will you track?' })}
      </Label>
      <select
        id="challenge-metric"
        value={metric}
        className="min-h-12 w-full rounded-md border bg-background p-3"
        onChange={(event) => {
          const allowed = CHALLENGE_TYPES.filter(
            (type) => type.metric === event.target.value
          );
          const next =
            allowed.find((type) => type.scoring_mode === mode) ?? allowed[0];
          if (next) onChange(next.metric, next.scoring_mode);
        }}
      >
        {(['movement', 'workout', 'hydration'] as const).map((group) => (
          <optgroup key={group} label={groups[group]}>
            {[
              ...new Set(
                CHALLENGE_TYPES.filter((type) => type.group === group).map(
                  (type) => type.metric
                )
              ),
            ].map((value) => (
              <option key={value} value={value}>
                {challengeMetricText(t, value)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <RadioGroup
        className="flex flex-wrap gap-x-6 gap-y-2"
        value={mode}
        aria-label={t('challenges.ux.comparison', {
          defaultValue: 'Compare by',
        })}
        onValueChange={(next) => {
          const choice = supported.find((type) => type.scoring_mode === next);
          if (choice) onChange(metric, choice.scoring_mode);
        }}
      >
        {supported.map((type) => (
          <Label
            key={type.id}
            className="flex min-h-12 cursor-pointer items-center gap-2"
            htmlFor={`challenge-mode-${type.scoring_mode}`}
          >
            <RadioGroupItem
              value={type.scoring_mode}
              id={`challenge-mode-${type.scoring_mode}`}
            />
            {modes[type.scoring_mode]}
          </Label>
        ))}
      </RadioGroup>
      <p className="text-sm text-muted-foreground">
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
      </p>
    </div>
  );
}
