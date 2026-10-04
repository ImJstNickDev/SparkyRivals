import { MoveGoalImport } from '../components/MoveGoalImport';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { challengeTargetSchema, todayInZone } from '@workspace/shared';
import { usePreferences } from '../hooks/usePreferences';
import { useChallengeIdentity } from '../hooks/useChallenges';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { goalsQueryKey } from '../hooks/queryKeys';
import { fetchDailyGoals, saveDailyGoals } from '../services/api/goalsApi';
import type { DailyGoals } from '../types/goals';
import Button from '../components/ui/Button';
import FormInput from '../components/FormInput';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import {
  ChallengeFrame,
  ChallengeLoading,
  ChallengeProblem,
  useChallengeFormat,
} from '../components/challenges/ChallengeChrome';

const fields = [
  ['steps_goal', 'Daily steps', 'steps', 1],
  ['distance_goal_meters', 'Daily distance', 'km', 1000],
  ['active_calories_goal', 'Daily active calories', 'kcal', 1],
  ['target_exercise_duration_minutes', 'Workout duration', 'minutes', 1],
  ['target_exercise_calories_burned', 'Workout calories', 'kcal', 1],
  ['water_goal_ml', 'Hydration', 'ml', 1],
] as const;
export default function PersonalGoalsScreen() {
  const { t } = useChallengeFormat();
  const { enabled, actor } = useChallengeIdentity();
  const { preferences } = usePreferences({ enabled });
  const header = useScreenHeader({
    title: t('goals.personal', { defaultValue: 'Personal activity goals' }),
    left: { kind: 'back' },
  });
  return (
    <ChallengeFrame header={header} keyboard>
      {enabled && preferences ? (
        <GoalsDate key={actor} timezone={preferences.timezone || 'UTC'} />
      ) : (
        <ChallengeLoading />
      )}
    </ChallengeFrame>
  );
}
function GoalsDate({ timezone }: { timezone: string }) {
  const { t, day } = useChallengeFormat();
  const [date, setDate] = useState(() => todayInZone(timezone));
  const calendar = useRef<CalendarSheetRef>(null);
  const goals = useQuery({
    queryKey: goalsQueryKey(date),
    queryFn: () => fetchDailyGoals(date),
  });
  return (
    <View className="gap-4">
      <Button
        accessibilityRole="button"
        variant="secondary"
        onPress={() => calendar.current?.present()}
      >
        {day(date)}
      </Button>
      <Text className="text-text-secondary">
        {t('goals.activityExplanation', {
          defaultValue:
            'Goals use your normal dated goal timeline. They can suggest a Challenge target; changing a personal goal never changes a locked Challenge target.',
        })}
      </Text>
      {goals.isError ? (
        <ChallengeProblem retry={() => void goals.refetch()} />
      ) : goals.data ? (
        <GoalsForm key={date} date={date} goals={goals.data} />
      ) : (
        <ChallengeLoading />
      )}
      <CalendarSheet
        ref={calendar}
        selectedDate={date}
        onSelectDate={setDate}
      />
    </View>
  );
}
function GoalsForm({ date, goals }: { date: string; goals: DailyGoals }) {
  const { t } = useChallengeFormat();
  const client = useQueryClient();
  const labels = {
    steps_goal: t('goals.steps_goal', { defaultValue: 'Daily steps' }),
    distance_goal_meters: t('goals.distance_goal_meters', {
      defaultValue: 'Daily distance',
    }),
    active_calories_goal: t('goals.active_calories_goal', {
      defaultValue: 'Daily active calories',
    }),
    target_exercise_duration_minutes: t(
      'goals.target_exercise_duration_minutes',
      { defaultValue: 'Workout duration' }
    ),
    target_exercise_calories_burned: t(
      'goals.target_exercise_calories_burned',
      { defaultValue: 'Workout calories' }
    ),
    water_goal_ml: t('goals.water_goal_ml', { defaultValue: 'Hydration' }),
  };
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map(([field, , , factor]) => [
        field,
        goals[field] == null || goals[field] === 0
          ? ''
          : String(Number(goals[field]) / factor),
      ])
    )
  );
  const [invalid, setInvalid] = useState(false);
  const mutation = useMutation({
    mutationFn: (next: DailyGoals) => saveDailyGoals(date, next),
    onSuccess: async () => {
      await Promise.all(
        ['goals', 'goalsRange', 'dailySummary', 'dailyProgress'].map((key) =>
          client.invalidateQueries({ queryKey: [key] })
        )
      );
    },
  });
  const save = () => {
    const updates: Partial<DailyGoals> = {};
    for (const [field, , , factor] of fields) {
      const value = values[field];
      if (!value?.trim()) {
        if (
          field === 'steps_goal' ||
          field === 'distance_goal_meters' ||
          field === 'active_calories_goal'
        )
          updates[field] = null;
        else updates[field] = 0;
        continue;
      }
      const parsed = challengeTargetSchema.safeParse(Number(value) * factor);
      if (!parsed.success) {
        setInvalid(true);
        return;
      }
      updates[field] = parsed.data;
    }
    setInvalid(false);
    mutation.mutate({ ...goals, ...updates });
  };
  return (
    <View className="gap-4">
      {fields.map(([field, , unit]) => (
        <View key={field} className="gap-2">
          <Text className="text-text-primary">
            {labels[field]} ({unit})
          </Text>
          <FormInput
            accessibilityLabel={`${labels[field]} (${unit})`}
            value={values[field]}
            onChangeText={(value) =>
              setValues((previous) => ({ ...previous, [field]: value }))
            }
            keyboardType="decimal-pad"
            editable={!mutation.isPending}
          />
        </View>
      ))}
      <MoveGoalImport
        onUse={(kcal) =>
          setValues((previous) => ({
            ...previous,
            active_calories_goal: String(kcal),
          }))
        }
      />
      {invalid && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('goals.invalid', {
            defaultValue: 'Use positive numbers or leave a goal blank.',
          })}
        </Text>
      )}
      {mutation.isError && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('goals.saveError', {
            defaultValue: 'Could not save goals. Try again.',
          })}
        </Text>
      )}
      {mutation.isSuccess && (
        <Text accessibilityRole="text" className="text-text-primary">
          {t('goals.saved', { defaultValue: 'Goals saved' })}
        </Text>
      )}
      <Button
        accessibilityRole="button"
        onPress={save}
        disabled={mutation.isPending}
      >
        {t('common.save', { defaultValue: 'Save' })}
      </Button>
    </View>
  );
}
