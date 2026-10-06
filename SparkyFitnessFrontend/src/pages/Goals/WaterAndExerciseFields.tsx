import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  challengeDisplayUnitText,
  challengeTargetInput,
  parseDecimalInput,
  toFiniteNumber,
  userGoalsSchema,
} from '@workspace/shared';
import type { ExpandedGoals } from '@/types/goals';

type WaterExerciseBase = Pick<
  ExpandedGoals,
  | 'water_goal_ml'
  | 'steps_goal'
  | 'distance_goal_meters'
  | 'active_calories_goal'
  | 'target_exercise_calories_burned'
  | 'target_exercise_duration_minutes'
>;
type Field = keyof WaterExerciseBase;

function GoalNumberInput({
  id,
  canonical,
  factor,
  locale,
  optional,
  onChange,
  onValidityChange,
}: {
  id: Field;
  canonical: number | null | undefined;
  factor: number;
  locale: string;
  optional: boolean;
  onChange: (value: number | null) => void;
  onValidityChange: (field: Field, valid: boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [valid, setValid] = useState(true);
  const formatted =
    canonical == null
      ? ''
      : new Intl.NumberFormat(locale, {
          useGrouping: false,
          maximumFractionDigits: 6,
        }).format(toFiniteNumber(canonical) / factor);
  return (
    <>
      <Input
        id={id}
        inputMode="decimal"
        value={draft ?? formatted}
        aria-invalid={!valid}
        aria-describedby={!valid ? `${id}-error` : undefined}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const next =
            text.trim() === ''
              ? optional
                ? null
                : 0
              : Math.round(parseDecimalInput(text) * factor * 1_000_000) /
                1_000_000;
          const parsed = userGoalsSchema.shape[id].safeParse(next);
          const ok = parsed.success && (next == null || next >= 0);
          setValid(ok);
          onValidityChange(id, ok);
          if (ok) onChange(next);
        }}
        onBlur={() => {
          if (valid) setDraft(null);
        }}
      />
      {!valid && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {t('challenges.invalidTarget', {
            defaultValue:
              'Enter a positive target with at most six decimal places in the canonical unit.',
          })}
        </p>
      )}
    </>
  );
}

export const WaterAndExerciseFields = <T extends WaterExerciseBase>({
  state,
  setState,
  onValidityChange,
}: {
  state: T;
  setState: (newState: T) => void;
  onValidityChange: (valid: boolean) => void;
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const {
    water_display_unit: water = 'ml',
    setWaterDisplayUnit,
    distanceUnit = 'km',
    energyUnit = 'kcal',
    saveAllPreferences,
  } = usePreferences();
  const [invalid, setInvalid] = useState<ReadonlySet<Field>>(() => new Set());
  useEffect(
    () => onValidityChange(invalid.size === 0),
    [invalid, onValidityChange]
  );
  const validField = (field: Field, valid: boolean) =>
    setInvalid((previous) => {
      const next = new Set(previous);
      if (valid) next.delete(field);
      else next.add(field);
      return next;
    });
  const preferences = { distance: distanceUnit, energy: energyUnit, water };
  const energyFactor = challengeTargetInput(
    'active_calories',
    preferences
  ).factor;
  const waterFactor = challengeTargetInput('hydration', preferences).factor;
  const fields = [
    {
      field: 'steps_goal',
      label: t('goals.steps_goal', { defaultValue: 'Daily steps' }),
      factor: 1,
      unit: 'steps',
      optional: true,
    },
    {
      field: 'distance_goal_meters',
      label: t('goals.distance_goal_meters', {
        defaultValue: 'Daily distance',
      }),
      factor: challengeTargetInput('distance', preferences).factor,
      unit: distanceUnit === 'miles' ? 'mi' : 'km',
      optional: true,
    },
    {
      field: 'active_calories_goal',
      label: t('goals.active_calories_goal', {
        defaultValue: 'Daily active calories',
      }),
      factor: energyFactor,
      unit: energyUnit,
      optional: true,
    },
    {
      field: 'water_goal_ml',
      label: t('challenges.metrics.hydration', { defaultValue: 'Hydration' }),
      factor: waterFactor,
      unit: water === 'liter' ? 'L' : water === 'oz' ? 'fl_oz' : water,
      optional: false,
    },
    {
      field: 'target_exercise_calories_burned',
      label: t('challenges.metrics.workoutCalories', {
        defaultValue: 'Workout calories',
      }),
      factor: energyFactor,
      unit: energyUnit,
      optional: false,
    },
    {
      field: 'target_exercise_duration_minutes',
      label: t('challenges.metrics.workoutTime', {
        defaultValue: 'Workout time',
      }),
      factor: 1,
      unit: 'minutes',
      optional: false,
    },
  ] as const;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(({ field, label, factor, unit, optional }) => (
        <div key={field} className="space-y-1.5">
          <Label htmlFor={field}>
            {t('challenges.ux.fieldWithUnit', {
              defaultValue: '{{label}} ({{unit}})',
              label,
              unit: challengeDisplayUnitText(t, unit),
            })}
          </Label>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <GoalNumberInput
                key={`${field}:${unit}`}
                id={field}
                canonical={state[field]}
                factor={factor}
                locale={locale}
                optional={optional}
                onChange={(value) => setState({ ...state, [field]: value })}
                onValidityChange={validField}
              />
            </div>
            {field === 'water_goal_ml' && (
              <Select
                value={water}
                onValueChange={(value: 'ml' | 'oz' | 'liter') => {
                  void saveAllPreferences({ water_display_unit: value });
                  setWaterDisplayUnit(value);
                  validField(field, true);
                }}
              >
                <SelectTrigger
                  className="w-20"
                  aria-label={t('challenges.ux.waterUnit', {
                    defaultValue: 'Water unit',
                  })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['ml', 'oz', 'liter'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {challengeDisplayUnitText(
                        t,
                        value === 'liter'
                          ? 'L'
                          : value === 'oz'
                            ? 'fl_oz'
                            : value
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
