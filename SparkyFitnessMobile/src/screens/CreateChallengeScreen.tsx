import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeTimezoneSchema,
} from '@workspace/shared';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '../hooks/useChallenges';
import { usePreferences } from '../hooks/usePreferences';
import { useScreenHeader } from '../hooks/useScreenHeader';
import Button from '../components/ui/Button';
import SegmentedControl from '../components/SegmentedControl';
import FormInput from '../components/FormInput';
import CalendarSheet, {
  type CalendarSheetRef,
} from '../components/CalendarSheet';
import {
  ChallengeFrame,
  ChallengeLoading,
  ChallengeProblem,
  ChallengeMutationError,
  useChallengeFormat,
} from '../components/challenges/ChallengeChrome';
import { ChallengeInvitees } from '../components/challenges/ChallengeInvitees';

type Props = RootStackScreenProps<'CreateChallenge'>;
export default function CreateChallengeScreen({ navigation }: Props) {
  const { t } = useChallengeFormat();
  const identity = useChallengeIdentity();
  const preferences = usePreferences({ enabled: identity.enabled });
  const header = useScreenHeader({
    title: t('challenges.create', { defaultValue: 'Create Challenge' }),
    left: { kind: 'back' },
  });
  const timezone =
    preferences.preferences?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <ChallengeFrame header={header} keyboard>
      {identity.isError ? (
        <ChallengeProblem retry={() => void identity.refetch()} />
      ) : identity.isLoading || preferences.isLoading ? (
        <ChallengeLoading />
      ) : preferences.isError ? (
        <ChallengeProblem retry={() => void preferences.refetch()} />
      ) : (
        <CreateForm
          key={timezone}
          timezoneDefault={timezone}
          navigation={navigation}
        />
      )}
    </ChallengeFrame>
  );
}
function CreateForm({
  timezoneDefault,
  navigation,
}: {
  timezoneDefault: string;
  navigation: Props['navigation'];
}) {
  const [metric, setMetric] = useState<'steps' | 'workout_time'>('steps');
  const { t, day, rules } = useChallengeFormat(metric);
  const mutation = useChallengeMutation();
  const busy = useRef(false);
  const [timezone, setTimezone] = useState(timezoneDefault);
  const [start, setStart] = useState(
    todayInZone(
      challengeTimezoneSchema.safeParse(timezoneDefault).success
        ? timezoneDefault
        : 'UTC'
    )
  );
  const [end, setEnd] = useState(addDays(start, 6));
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const startCalendar = useRef<CalendarSheetRef>(null);
  const endCalendar = useRef<CalendarSheetRef>(null);
  const validZone = challengeTimezoneSchema.safeParse(timezone).success;
  const submit = async () => {
    if (busy.current) return;
    const parsed = createChallengeRequestSchema.safeParse({
      name,
      metric,
      start_date: start,
      end_date: end,
      timezone,
      participant_ids: selected,
    });
    const today = validZone ? todayInZone(timezone) : '';
    if (
      !parsed.success ||
      start < today ||
      start > addDays(today || start, 366)
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    busy.current = true;
    try {
      const result = await mutation.mutateAsync({
        action: 'create',
        body: parsed.data,
      });
      if (result)
        navigation.replace('ChallengeDetail', { id: result.challenge.id });
    } catch {
      /* Keep inputs and display the mutation failure. */
    } finally {
      busy.current = false;
    }
  };
  const preset = (days: number) => {
    if (!validZone) return;
    const today = todayInZone(timezone);
    setStart(today);
    setEnd(addDays(today, days - 1));
  };
  return (
    <View className="gap-6">
      <Text className="text-text-secondary text-base">
        {t('challenges.createDescription', {
          defaultValue:
            'Choose your days, invite your people, and keep moving together.',
        })}
      </Text>
      <SegmentedControl
        segments={[
          {
            key: 'steps',
            label: t('challenges.stepsMetric', { defaultValue: 'Steps' }),
          },
          {
            key: 'workout_time',
            label: t('challenges.workoutTime', {
              defaultValue: 'Workout time',
            }),
          },
        ]}
        activeKey={metric}
        onSelect={setMetric}
      />
      <View className="rounded-2xl bg-surface p-5 gap-2">
        <Text className="text-text-primary font-semibold text-lg">{rules}</Text>
        <Text className="text-text-secondary">
          {metric === 'workout_time'
            ? t('challenges.workoutHint', {
                defaultValue:
                  'Recorded qualifying workout duration counts. Calories and workout count do not decide the winner.',
              })
            : t('challenges.canonicalHint', {
                defaultValue:
                  'Your existing daily step totals count. There is nothing extra to track.',
              })}
        </Text>
      </View>
      <View className="gap-2">
        <Text className="text-text-primary font-semibold">
          {t('challenges.name', { defaultValue: 'Challenge name' })}
        </Text>
        <FormInput
          accessibilityLabel={t('challenges.name', {
            defaultValue: 'Challenge name',
          })}
          value={name}
          onChangeText={setName}
          maxLength={100}
          editable={!mutation.isPending}
          placeholder={t('challenges.namePlaceholder', {
            defaultValue: 'Our next seven days',
          })}
        />
      </View>
      <View className="flex-row flex-wrap gap-3">
        <Button
          accessibilityRole="button"
          variant="secondary"
          disabled={!validZone}
          onPress={() => preset(1)}
        >
          {t('challenges.todayPreset', { defaultValue: 'Today' })}
        </Button>
        <Button
          accessibilityRole="button"
          variant="secondary"
          disabled={!validZone}
          onPress={() => preset(7)}
        >
          {t('challenges.weekPreset', { defaultValue: '7 days from today' })}
        </Button>
      </View>
      <View className="gap-2">
        <Text className="text-text-primary font-semibold">
          {t('challenges.startDate', { defaultValue: 'Start date' })}
        </Text>
        <Button
          accessibilityRole="button"
          accessibilityLabel={t('challenges.chooseStart', {
            defaultValue: 'Choose start date',
          })}
          variant="secondary"
          onPress={() => startCalendar.current?.present()}
        >
          {day(start)}
        </Button>
        <Text className="text-text-primary font-semibold">
          {t('challenges.endDate', { defaultValue: 'End date' })}
        </Text>
        <Button
          accessibilityRole="button"
          accessibilityLabel={t('challenges.chooseEnd', {
            defaultValue: 'Choose end date',
          })}
          variant="secondary"
          onPress={() => endCalendar.current?.present()}
        >
          {day(end)}
        </Button>
      </View>
      <ChallengeInvitees selected={selected} onChange={setSelected} />
      <Button
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        variant="ghost"
        onPress={() => setAdvanced(!advanced)}
      >
        {t('challenges.timezoneDetails', {
          defaultValue: 'Timezone & daily totals',
        })}
      </Button>
      {advanced && (
        <View className="gap-3">
          <Text className="text-text-primary">
            {t('challenges.timezone', { defaultValue: 'Challenge timezone' })}
          </Text>
          <FormInput
            accessibilityLabel={t('challenges.timezone', {
              defaultValue: 'Challenge timezone',
            })}
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-text-secondary">
            {metric === 'workout_time'
              ? t('challenges.workoutTimezoneHint', {
                  defaultValue:
                    'This sets when the Challenge starts and ends. Workouts keep their existing daily date buckets.',
                })
              : t('challenges.timezoneHint', {
                  defaultValue:
                    'This sets when the Challenge starts and ends. Steps keep their existing daily date buckets.',
                })}
          </Text>
        </View>
      )}
      <View className="rounded-2xl bg-surface p-5 gap-2">
        <Text
          accessibilityRole="header"
          className="text-text-primary text-lg font-semibold"
        >
          {t('challenges.review', { defaultValue: 'Ready to go?' })}
        </Text>
        <Text className="text-text-primary">
          {day(start)} – {day(end)}
        </Text>
        <Text className="text-text-secondary">{timezone}</Text>
        <Text className="text-text-secondary">
          {t('challenges.creatorJoined', {
            defaultValue:
              'You join automatically. Your friends receive invitations.',
          })}
        </Text>
      </View>
      {invalid && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('challenges.validationError', {
            defaultValue:
              'Add a name, a valid timezone and a date range of 1–366 days starting today or within the next year.',
          })}
        </Text>
      )}
      {mutation.isError && <ChallengeMutationError />}
      <Button
        accessibilityRole="button"
        disabled={mutation.isPending}
        onPress={() => void submit()}
      >
        {mutation.isPending
          ? t('challenges.saving', { defaultValue: 'Saving…' })
          : t('challenges.create', { defaultValue: 'Create Challenge' })}
      </Button>
      <CalendarSheet
        ref={startCalendar}
        selectedDate={start}
        onSelectDate={setStart}
      />
      <CalendarSheet
        ref={endCalendar}
        selectedDate={end}
        onSelectDate={setEnd}
      />
    </View>
  );
}
