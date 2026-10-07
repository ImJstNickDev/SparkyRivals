import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View, Switch, type TextInput } from 'react-native';
import {
  prepareChallengeRematch,
  CHALLENGE_TYPES,
  type ChallengeRematchDraft,
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeTimezoneSchema,
} from '@workspace/shared';
import type { RootStackScreenProps } from '../types/navigation';
import {
  useChallengeDetail,
  useChallengeConnections,
  useChallengeIdentity,
  useChallengeMutation,
} from '../hooks/useChallenges';
import { usePreferences } from '../hooks/usePreferences';
import { useScreenHeader } from '../hooks/useScreenHeader';
import Button from '../components/ui/Button';
import { ChallengeTypePicker } from '../components/challenges/ChallengeTypePicker';
import FooterActionBar from '../components/FooterActionBar';
import { useUnsavedFormGuard } from '../hooks/useUnsavedFormGuard';
import { parseDecimalInput } from '../utils/numericInput';
import { getCompanionChallengeSession } from '../services/companionChallengeSession';
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
export default function CreateChallengeScreen({ navigation, route }: Props) {
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
  const pending = identity.isLoading || preferences.isLoading;
  if (identity.isError || preferences.isError || pending)
    return (
      <ChallengeFrame header={header}>
        {pending ? (
          <ChallengeLoading />
        ) : (
          <ChallengeProblem
            retry={() => {
              void identity.refetch();
              void preferences.refetch();
            }}
          />
        )}
      </ChallengeFrame>
    );
  return route?.params?.rematchId ? (
    <RematchForm
      id={route.params.rematchId}
      navigation={navigation}
      header={header}
    />
  ) : (
    <CreateForm
      key={`${identity.actor}:${getCompanionChallengeSession().revision}`}
      timezoneDefault={timezone}
      navigation={navigation}
      header={header}
    />
  );
}
function RematchForm({
  id,
  navigation,
  header,
}: {
  header: ReactNode;
  id: string;
  navigation: Props['navigation'];
}) {
  const detail = useChallengeDetail(id);
  const connections = useChallengeConnections();
  const { actor } = useChallengeIdentity();
  if (detail.isError || connections.isError)
    return (
      <ChallengeFrame header={header}>
        <ChallengeProblem
          retry={() => {
            void detail.refetch();
            void connections.refetch();
          }}
        />
      </ChallengeFrame>
    );
  if (!detail.data || !connections.data)
    return (
      <ChallengeFrame header={header}>
        <ChallengeLoading />
      </ChallengeFrame>
    );
  const draft = prepareChallengeRematch(detail.data, connections.data, actor);
  if (!draft)
    return (
      <ChallengeFrame header={header}>
        <ChallengeProblem retry={() => void detail.refetch()} />
      </ChallengeFrame>
    );
  return (
    <CreateForm
      key={id}
      header={header}
      timezoneDefault={draft.timezone}
      draft={draft}
      navigation={navigation}
    />
  );
}
function CreateForm({
  timezoneDefault,
  navigation,
  draft,
  header,
}: {
  header: ReactNode;
  draft?: ChallengeRematchDraft;
  timezoneDefault: string;
  navigation: Props['navigation'];
}) {
  const [typeId, setTypeId] = useState<string>(
    CHALLENGE_TYPES.find(
      (type) =>
        type.metric === (draft?.metric ?? 'steps') &&
        type.scoring_mode === (draft?.scoring_mode ?? 'sum')
    )?.id ?? 'step-race'
  );
  const type = CHALLENGE_TYPES.find((type) => type.id === typeId)!;
  const { metric, scoring_mode } = type;
  const goalMode = scoring_mode !== 'sum';
  const [duration, setDuration] = useState(String(draft?.duration_days ?? 7));
  const [nextDay, setNextDay] = useState(draft?.start_next_day ?? false);
  const { t, day } = useChallengeFormat(metric, scoring_mode);
  const mutation = useChallengeMutation();
  const busy = useRef(false);
  const [timezone, setTimezone] = useState(timezoneDefault);
  const [start, setStart] = useState(
    draft?.start_date ??
      todayInZone(
        challengeTimezoneSchema.safeParse(timezoneDefault).success
          ? timezoneDefault
          : 'UTC'
      )
  );
  const [end, setEnd] = useState(draft?.end_date ?? addDays(start, 6));
  const [name, setName] = useState(draft?.name ?? '');
  const [selected, setSelected] = useState<string[]>(
    draft?.participant_ids ?? []
  );
  const [advanced, setAdvanced] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const nameInput = useRef<TextInput>(null);
  const durationInput = useRef<TextInput>(null);
  const timezoneInput = useRef<TextInput>(null);
  const [session] = useState(getCompanionChallengeSession);
  const mounted = useRef(true);
  const [created, setCreated] = useState<string | null>(null);
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
  const initial = useRef({
    name,
    typeId,
    duration,
    nextDay,
    timezone,
    start,
    end,
    selected: selected.join(','),
  });
  const dirty =
    JSON.stringify(initial.current) !==
    JSON.stringify({
      name,
      typeId,
      duration,
      nextDay,
      timezone,
      start,
      end,
      selected: selected.join(','),
    });
  useUnsavedFormGuard({
    dirty: dirty && !created,
    saving: mutation.isPending,
    current,
  });
  useEffect(() => {
    if (
      created &&
      mounted.current &&
      session === getCompanionChallengeSession() &&
      !session.blocked
    )
      navigation.replace('ChallengeDetail', { id: created });
  }, [created, navigation, session]);
  const startCalendar = useRef<CalendarSheetRef>(null);
  const endCalendar = useRef<CalendarSheetRef>(null);
  const validZone = challengeTimezoneSchema.safeParse(timezone).success;
  const submit = async () => {
    if (busy.current || !current() || created) return;
    const parsed = createChallengeRequestSchema.safeParse({
      name,
      metric,
      scoring_mode,
      ...(goalMode
        ? {
            duration_days: parseDecimalInput(duration),
            start_next_day: nextDay,
          }
        : { start_date: start, end_date: end }),
      timezone,
      participant_ids: selected,
    });
    const today = validZone ? todayInZone(timezone) : '';
    if (
      !parsed.success ||
      (!goalMode && (start < today || start > addDays(today || start, 366)))
    ) {
      const field = !parsed.success
        ? String(parsed.error.issues[0]?.path[0] ?? 'start_date')
        : 'start_date';
      setInvalid(field);
      if (field === 'name') nameInput.current?.focus();
      else if (field === 'duration_days') durationInput.current?.focus();
      else if (field === 'timezone') {
        setAdvanced(true);
        requestAnimationFrame(() => timezoneInput.current?.focus());
      } else startCalendar.current?.present();
      return;
    }
    setInvalid(null);
    busy.current = true;
    try {
      const result = await mutation.mutateAsync({
        action: 'create',
        body: parsed.data,
      });
      if (result && current()) setCreated(result.challenge.id);
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
  const error = (field: string) =>
    invalid === field ? (
      <Text accessibilityRole="alert" className="text-icon-danger">
        {t('challenges.validationError', {
          defaultValue:
            'Add a name, a valid timezone and a date range of 1–366 days starting today or within the next year.',
        })}
      </Text>
    ) : null;
  return (
    <ChallengeFrame
      header={header}
      keyboard
      footer={
        <FooterActionBar>
          <Button
            accessibilityRole="button"
            disabled={mutation.isPending || !!created}
            onPress={() => void submit()}
          >
            {mutation.isPending
              ? t('challenges.saving', { defaultValue: 'Saving…' })
              : t('challenges.create', { defaultValue: 'Create Challenge' })}
          </Button>
        </FooterActionBar>
      }
    >
      <ChallengeTypePicker
        metric={metric}
        mode={scoring_mode}
        disabled={mutation.isPending}
        onChange={(nextMetric, nextMode) =>
          setTypeId(
            CHALLENGE_TYPES.find(
              (item) =>
                item.metric === nextMetric && item.scoring_mode === nextMode
            )!.id
          )
        }
      />
      <View className="gap-2">
        <Text className="text-text-primary font-semibold">
          {t('challenges.name', { defaultValue: 'Challenge name' })}
        </Text>
        <FormInput
          ref={nameInput}
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
        {error('name')}
      </View>
      {goalMode ? (
        <View className="gap-3">
          <Text className="text-text-primary">
            {t('challenges.duration', {
              defaultValue: 'Duration in days (1–366)',
            })}
          </Text>
          <FormInput
            ref={durationInput}
            accessibilityLabel={t('challenges.duration', {
              defaultValue: 'Duration in days (1–366)',
            })}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            editable={!mutation.isPending}
          />
          {error('duration_days')}
          <View className="flex-row flex-wrap gap-2">
            {[3, 7, 14].map((days) => (
              <Button
                key={days}
                variant="secondary"
                accessibilityRole="button"
                accessibilityState={{
                  selected: parseDecimalInput(duration) === days,
                }}
                disabled={mutation.isPending}
                onPress={() => setDuration(String(days))}
              >
                {t('challenges.ux.duration', {
                  count: days,
                  defaultValue: '{{count}} days',
                  defaultValue_one: '{{count}} day',
                })}
              </Button>
            ))}
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-text-primary flex-1">
              {t('challenges.nextDay', {
                defaultValue: 'Start on next full day',
              })}
            </Text>
            <Switch
              accessibilityLabel={t('challenges.nextDay', {
                defaultValue: 'Start on next full day',
              })}
              disabled={mutation.isPending}
              value={nextDay}
              onValueChange={setNextDay}
            />
          </View>
          <Text className="text-text-secondary">
            {nextDay
              ? t('challenges.ux.nextDay', {
                  defaultValue: 'Starts the day after everyone is ready.',
                })
              : t('challenges.ux.todayIncluded', {
                  defaultValue:
                    "Starts when everyone is ready. That day's earlier activity counts too.",
                })}
          </Text>
        </View>
      ) : (
        <>
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
              {t('challenges.weekPreset', {
                defaultValue: '7 days from today',
              })}
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
          {error('start_date')}
          {error('end_date')}
        </>
      )}
      {draft && (
        <Text accessibilityRole="text" className="text-text-secondary">
          {t('challenges.rematchReview', {
            defaultValue:
              'Review your rematch. Everyone you invite will choose whether to join again.',
          })}
        </Text>
      )}
      {!!draft?.omitted && (
        <Text className="text-text-secondary">
          {t('challenges.rematchOmitted', {
            defaultValue:
              'Some previous participants are no longer eligible and have not been selected.',
          })}
        </Text>
      )}
      <ChallengeInvitees selected={selected} onChange={setSelected} />
      <Text className="text-text-secondary">{timezone}</Text>
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
            ref={timezoneInput}
            accessibilityLabel={t('challenges.timezone', {
              defaultValue: 'Challenge timezone',
            })}
            value={timezone}
            onChangeText={setTimezone}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error('timezone')}
        </View>
      )}
      <Text className="text-text-secondary text-sm">
        {t('challenges.creatorJoined', {
          defaultValue:
            'You join automatically. Your friends receive invitations.',
        })}
      </Text>
      {invalid &&
        ![
          'name',
          'duration_days',
          'start_date',
          'end_date',
          'timezone',
        ].includes(invalid) &&
        error(invalid)}
      {mutation.isError && <ChallengeMutationError />}
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
    </ChallengeFrame>
  );
}
