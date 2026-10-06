import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Text, View, type TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayInZone } from '@workspace/shared';
import Toast from 'react-native-toast-message';
import { usePreferences } from '../hooks/usePreferences';
import { useChallengeIdentity } from '../hooks/useChallenges';
import { useScreenHeader } from '../hooks/useScreenHeader';
import { useUnsavedFormGuard } from '../hooks/useUnsavedFormGuard';
import { goalsQueryKey } from '../hooks/queryKeys';
import { fetchDailyGoals, saveDailyGoals } from '../services/api/goalsApi';
import {
  getCompanionChallengeSession,
  subscribeCompanionChallengeSession,
} from '../services/companionChallengeSession';
import { useNativeIOSHeadersActive } from '../services/nativeTabBarPreference';
import type { DailyGoals } from '../types/goals';
import type { UserPreferences } from '../types/preferences';
import {
  personalGoalFields,
  createPersonalGoalDraft,
  applyPersonalGoalDraft,
  personalGoalDisplay,
  type PersonalGoalField,
} from '../utils/personalGoalDraft';
import { MoveGoalImport } from '../components/MoveGoalImport';
import { FooterSaveBar } from '../components/FormScreenChrome';
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

export default function PersonalGoalsScreen() {
  const { enabled, actor } = useChallengeIdentity();
  const preferences = usePreferences({ enabled });
  const session = useSyncExternalStore(
    subscribeCompanionChallengeSession,
    getCompanionChallengeSession
  );
  return enabled && preferences.preferences && !session.blocked ? (
    <GoalsDate
      key={`${actor}:${session.revision}`}
      preferences={preferences.preferences}
    />
  ) : (
    <GoalsPlaceholder
      retry={preferences.isError ? () => void preferences.refetch() : undefined}
    />
  );
}
function GoalsPlaceholder({ retry }: { retry?: () => void }) {
  const { t } = useChallengeFormat();
  const header = useScreenHeader({
    title: t('goals.personal', { defaultValue: 'Personal activity goals' }),
    left: { kind: 'back' },
  });
  return (
    <ChallengeFrame header={header}>
      {retry ? <ChallengeProblem retry={retry} /> : <ChallengeLoading />}
    </ChallengeFrame>
  );
}
function GoalsDate({ preferences }: { preferences: UserPreferences }) {
  const [date, setDate] = useState(() =>
    todayInZone(preferences.timezone || 'UTC')
  );
  const goals = useQuery({
    queryKey: goalsQueryKey(date),
    queryFn: () => fetchDailyGoals(date),
  });
  return goals.data ? (
    <GoalsForm
      key={date}
      date={date}
      setDate={setDate}
      goals={goals.data}
      preferences={preferences}
    />
  ) : (
    <GoalsPlaceholder
      retry={goals.isError ? () => void goals.refetch() : undefined}
    />
  );
}
function GoalsForm({
  date,
  setDate,
  goals,
  preferences,
}: {
  date: string;
  setDate: (date: string) => void;
  goals: DailyGoals;
  preferences: UserPreferences;
}) {
  const { t, day, locale } = useChallengeFormat();
  const navigation = useNavigation();
  const client = useQueryClient();
  const nativeHeader = useNativeIOSHeadersActive();
  const calendar = useRef<CalendarSheetRef>(null);
  const inputs = useRef<Partial<Record<PersonalGoalField, TextInput | null>>>(
    {}
  );
  // Freeze draft units, not app language: a preference/query refresh must not
  // reinterpret numbers the user is currently typing.
  const [draftPreferences] = useState(preferences);
  const [values, setValues] = useState(() =>
    createPersonalGoalDraft(goals, locale, draftPreferences)
  );
  const initialValues = useRef(values);
  const [edited, setEdited] = useState<Set<PersonalGoalField>>(() => new Set());
  const [invalid, setInvalid] = useState<PersonalGoalField | null>(null);
  const [saved, setSaved] = useState(false);
  const [session] = useState(getCompanionChallengeSession);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const returned = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () =>
    mounted.current &&
    !session.blocked &&
    session === getCompanionChallengeSession();
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
  const units = {
    steps_goal: t('challenges.units.steps', { defaultValue: 'steps' }),
    distance_goal_meters:
      draftPreferences.default_distance_unit === 'miles' ? 'mi' : 'km',
    active_calories_goal: draftPreferences.energy_unit ?? 'kcal',
    target_exercise_duration_minutes: t('goals.minutesUnit', {
      defaultValue: 'min',
    }),
    target_exercise_calories_burned: draftPreferences.energy_unit ?? 'kcal',
    water_goal_ml:
      draftPreferences.water_display_unit === 'liter'
        ? 'L'
        : draftPreferences.water_display_unit === 'oz'
          ? 'fl oz'
          : 'ml',
  };
  const mutation = useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async (next: DailyGoals) => {
      if (!current()) throw new Error('Goal identity unavailable');
      await saveDailyGoals(date, next);
    },
    onSuccess: async () => {
      if (!current()) return;
      await Promise.all(
        [
          'goals',
          'goalsRange',
          'dailySummary',
          'dailyProgress',
          'challenges',
        ].map((key) => client.invalidateQueries({ queryKey: [key] }))
      );
      if (current()) setSaved(true);
    },
  });
  const requestLeave = useUnsavedFormGuard({
    dirty: edited.size > 0 && !saved,
    saving: mutation.isPending,
    current,
  });
  useEffect(() => {
    if (
      saved &&
      !returned.current &&
      mounted.current &&
      getCompanionChallengeSession() === session &&
      !session.blocked
    ) {
      returned.current = true;
      Toast.show({
        type: 'success',
        text1: t('goals.saved', { defaultValue: 'Goals saved' }),
      });
      navigation.goBack();
    }
  }, [saved, session, navigation, t]);
  const save = async () => {
    if (inFlight.current || !current() || saved) return;
    const result = applyPersonalGoalDraft(
      goals,
      values,
      edited,
      draftPreferences
    );
    setInvalid(result.invalid ?? null);
    if (result.invalid) {
      inputs.current[result.invalid]?.focus();
      return;
    }
    inFlight.current = true;
    try {
      await mutation.mutateAsync(result.goals);
    } catch {
      /* The field draft stays visible for retry. */
    } finally {
      inFlight.current = false;
    }
  };
  const header = useScreenHeader({
    title: t('goals.personal', { defaultValue: 'Personal activity goals' }),
    left: { kind: 'back' },
    right: {
      kind: 'primary',
      placement: 'native-only',
      busy: mutation.isPending,
      disabled: mutation.isPending,
      onPress: () => void save(),
    },
  });
  const change = (field: PersonalGoalField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setEdited((previous) => {
      const next = new Set(previous);
      if (value === initialValues.current[field]) next.delete(field);
      else next.add(field);
      return next;
    });
    setInvalid(null);
  };
  return (
    <ChallengeFrame
      header={header}
      keyboard
      footer={
        !nativeHeader ? (
          <FooterSaveBar
            busy={mutation.isPending}
            disabled={mutation.isPending}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      <Button
        accessibilityRole="button"
        variant="secondary"
        disabled={mutation.isPending}
        onPress={() => calendar.current?.present()}
      >
        {day(date)}
      </Button>
      {personalGoalFields.map((field) => (
        <View key={field} className="gap-2">
          <Text className="text-text-primary">
            {t('goals.fieldWithUnit', {
              defaultValue: '{{label}} ({{unit}})',
              label: labels[field],
              unit: units[field],
            })}
          </Text>
          <FormInput
            ref={(ref) => {
              inputs.current[field] = ref;
            }}
            accessibilityLabel={labels[field]}
            value={values[field]}
            onChangeText={(value) => change(field, value)}
            keyboardType="decimal-pad"
            editable={!mutation.isPending}
          />
          {invalid === field && (
            <Text accessibilityRole="alert" className="text-icon-danger">
              {t('goals.invalid', {
                defaultValue: 'Use positive numbers or leave a goal blank.',
              })}
            </Text>
          )}
          {field === 'active_calories_goal' && (
            <MoveGoalImport
              disabled={mutation.isPending}
              onUse={(kcal) =>
                change(
                  field,
                  new Intl.NumberFormat(locale, {
                    useGrouping: false,
                    maximumFractionDigits: 6,
                  }).format(personalGoalDisplay(kcal, field, draftPreferences))
                )
              }
            />
          )}
        </View>
      ))}
      {mutation.isError && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('goals.saveError', {
            defaultValue: 'Could not save goals. Try again.',
          })}
        </Text>
      )}
      <CalendarSheet
        ref={calendar}
        selectedDate={date}
        onSelectDate={(next) => {
          if (next !== date) requestLeave(() => setDate(next));
        }}
      />
    </ChallengeFrame>
  );
}
