import { challengeTargetSchema, convertEnergyValue } from '@workspace/shared';
import type { DailyGoals } from '../types/goals';
import type { UserPreferences } from '../types/preferences';
import { distanceFromKm, distanceToKm, volumeFromMl } from './unitConversions';
import { parseDecimalInput, toFiniteNumber } from './numericInput';

export const personalGoalFields = [
  'steps_goal',
  'distance_goal_meters',
  'active_calories_goal',
  'target_exercise_duration_minutes',
  'target_exercise_calories_burned',
  'water_goal_ml',
] as const;
export type PersonalGoalField = (typeof personalGoalFields)[number];
export type PersonalGoalDraft = Record<PersonalGoalField, string>;

export function personalGoalDisplay(
  value: number,
  field: PersonalGoalField,
  preferences: UserPreferences
) {
  if (field === 'distance_goal_meters')
    return distanceFromKm(
      value / 1000,
      preferences.default_distance_unit ?? 'km'
    );
  if (
    field === 'active_calories_goal' ||
    field === 'target_exercise_calories_burned'
  )
    return convertEnergyValue(value, 'kcal', preferences.energy_unit ?? 'kcal');
  if (field === 'water_goal_ml')
    return volumeFromMl(value, preferences.water_display_unit ?? 'ml');
  return value;
}

export function createPersonalGoalDraft(
  goals: DailyGoals,
  locale: string,
  preferences: UserPreferences
): PersonalGoalDraft {
  const number = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 6,
  });
  return Object.fromEntries(
    personalGoalFields.map((field) => [
      field,
      goals[field] == null
        ? ''
        : number.format(
            personalGoalDisplay(
              toFiniteNumber(goals[field]),
              field,
              preferences
            )
          ),
    ])
  ) as PersonalGoalDraft;
}

/** Unchanged fields retain the latest canonical value, including null/zero and
 * precision beyond what an editable display shows. Nutrition stays untouched. */
export function applyPersonalGoalDraft(
  goals: DailyGoals,
  draft: PersonalGoalDraft,
  edited: ReadonlySet<PersonalGoalField>,
  preferences: UserPreferences
):
  | { goals: DailyGoals; invalid?: never }
  | { invalid: PersonalGoalField; goals?: never } {
  const next = { ...goals };
  for (const field of personalGoalFields) {
    if (!edited.has(field)) continue;
    const text = draft[field].trim();
    if (!text) {
      if (
        field === 'steps_goal' ||
        field === 'distance_goal_meters' ||
        field === 'active_calories_goal'
      )
        next[field] = null;
      else next[field] = 0;
      continue;
    }
    let value = parseDecimalInput(text);
    if (field === 'distance_goal_meters')
      value =
        distanceToKm(value, preferences.default_distance_unit ?? 'km') * 1000;
    if (
      field === 'active_calories_goal' ||
      field === 'target_exercise_calories_burned'
    )
      value = convertEnergyValue(
        value,
        preferences.energy_unit ?? 'kcal',
        'kcal'
      );
    if (field === 'water_goal_ml')
      value /= volumeFromMl(1, preferences.water_display_unit ?? 'ml');
    // Conversions can introduce binary noise; API target precision is six decimals.
    const parsed = challengeTargetSchema.safeParse(
      Math.round(value * 1_000_000) / 1_000_000
    );
    if (!parsed.success) return { invalid: field };
    next[field] = parsed.data;
  }
  return { goals: next };
}
