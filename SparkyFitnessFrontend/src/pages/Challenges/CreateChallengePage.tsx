import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  prepareChallengeRematch,
  CHALLENGE_TYPES,
  type ChallengeRematchDraft,
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeTimezoneSchema,
} from '@workspace/shared';
import { Footprints, Timer } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import {
  useChallengeMutation,
  useChallengeDetail,
  useChallengeConnections,
  useChallengeIdentity,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimezoneSelect } from '@/pages/Settings/TimezoneSelect';
import { ChallengeInvitees } from './ChallengeInvitees';
import {
  ChallengeShell,
  ChallengeLoading,
  ChallengeError,
} from './ChallengeChrome';
import { useChallengeFormat } from './presentation';

export default function CreateChallengePage() {
  const preferences = usePreferences();
  const [params] = useSearchParams();
  const rematchId = params.get('rematch');
  return (
    <ChallengeShell back>
      {rematchId ? (
        <RematchForm id={rematchId} />
      ) : (
        <CreateForm
          key={preferences.timezone}
          defaultTimezone={preferences.timezone}
        />
      )}
    </ChallengeShell>
  );
}
function RematchForm({ id }: { id: string }) {
  const detail = useChallengeDetail(id);
  const connections = useChallengeConnections();
  const { actor } = useChallengeIdentity();
  if (detail.isError || connections.isError)
    return (
      <ChallengeError
        retry={() => {
          void detail.refetch();
          void connections.refetch();
        }}
      />
    );
  if (!detail.data || !connections.data) return <ChallengeLoading />;
  const draft = prepareChallengeRematch(detail.data, connections.data, actor);
  if (!draft) return <ChallengeError retry={() => void detail.refetch()} />;
  return <CreateForm key={id} defaultTimezone={draft.timezone} draft={draft} />;
}
function CreateForm({
  defaultTimezone,
  draft,
}: {
  defaultTimezone: string;
  draft?: ChallengeRematchDraft;
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
  const { t, day, rules } = useChallengeFormat(metric, scoring_mode);
  const [timezone, setTimezone] = useState(
    defaultTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [start, setStart] = useState(
    draft?.start_date ?? todayInZone(timezone)
  );
  const [end, setEnd] = useState(draft?.end_date ?? addDays(start, 6));
  const [name, setName] = useState(draft?.name ?? '');
  const [selected, setSelected] = useState<string[]>(
    draft?.participant_ids ?? []
  );
  const [validationError, setValidationError] = useState(false);
  const mutation = useChallengeMutation();
  const busy = useRef(false);
  const navigate = useNavigate();
  const today = todayInZone(timezone);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const parsed = createChallengeRequestSchema.safeParse({
      name,
      metric,
      scoring_mode,
      ...(goalMode
        ? { duration_days: Number(duration), start_next_day: nextDay }
        : { start_date: start, end_date: end }),
      timezone,
      participant_ids: selected,
    });
    if (
      !parsed.success ||
      (!goalMode && (start < today || start > addDays(today, 366)))
    ) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    busy.current = true;
    try {
      const result = await mutation.mutateAsync({
        action: 'create',
        body: parsed.data,
      });
      if (result)
        navigate(`/challenges/${result.challenge.id}`, { replace: true });
    } catch {
      /* Remain on the form; no offline success or queued action. */
    } finally {
      busy.current = false;
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto max-w-2xl space-y-7"
      noValidate
    >
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          {t('challenges.eyebrow', 'A little friendly competition')}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t('challenges.create', 'Create Challenge')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'challenges.createDescription',
            'Choose your days, invite your people, and keep moving together.'
          )}
        </p>
      </header>
      <div className="space-y-2">
        <Label htmlFor="challenge-type">
          {t('challenges.type', 'Challenge type')}
        </Label>
        <select
          id="challenge-type"
          className="w-full rounded-md border bg-background p-3"
          value={typeId}
          onChange={(event) => setTypeId(event.target.value)}
        >
          {['movement', 'workout', 'hydration'].map((group) => (
            <optgroup
              key={group}
              label={t(`challenges.groups.${group}`, { defaultValue: group })}
            >
              {CHALLENGE_TYPES.filter((item) => item.group === group).map(
                (item) => (
                  <option key={item.id} value={item.id}>
                    {t(`challenges.types.${item.id}`, {
                      defaultValue: item.label,
                    })}
                  </option>
                )
              )}
            </optgroup>
          ))}
        </select>
      </div>
      <section className="flex items-center gap-4 rounded-3xl bg-primary/5 p-5">
        {metric === 'workout_time' ? (
          <Timer aria-hidden className="h-9 w-9 shrink-0" />
        ) : (
          <Footprints aria-hidden className="h-9 w-9 shrink-0" />
        )}
        <div>
          <h2 className="font-semibold">{rules}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {goalMode || !['steps', 'workout_time'].includes(metric)
              ? t('challenges.metricHint', {
                  defaultValue:
                    'Only the chosen daily aggregate is shared after acceptance. Personal targets are confirmed in the lobby and lock when everyone is Ready.',
                })
              : metric === 'workout_time'
                ? t('challenges.workoutHint', {
                    defaultValue:
                      'Recorded qualifying workout duration counts. Calories and workout count do not decide the winner.',
                  })
                : t(
                    'challenges.canonicalHint',
                    'Your existing daily step totals count. There is nothing extra to track.'
                  )}
          </p>
        </div>
      </section>
      <div className="space-y-2">
        <Label htmlFor="challenge-name">
          {t('challenges.name', 'Challenge name')}
        </Label>
        <Input
          id="challenge-name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('challenges.namePlaceholder', 'Our next seven days')}
        />
      </div>
      {goalMode ? (
        <fieldset className="space-y-3">
          <Label htmlFor="challenge-duration">
            {t('challenges.duration', 'Duration in days (1–366)')}
          </Label>
          <Input
            id="challenge-duration"
            type="number"
            min={1}
            max={366}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={nextDay}
              onChange={(event) => setNextDay(event.target.checked)}
            />
            {t('challenges.nextDay', 'Start on next full day')}
          </label>
          <p className="text-sm text-muted-foreground">
            {t(
              'challenges.readyTiming',
              'Starts when all invitations are resolved and everyone is Ready. With next full day off, the entire current day counts, including activity before activation.'
            )}
          </p>
        </fieldset>
      ) : (
        <fieldset className="space-y-4">
          <legend className="font-semibold">
            {t('challenges.chooseDays', 'Choose your days')}
          </legend>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStart(today);
                setEnd(today);
              }}
            >
              {t('challenges.todayPreset', 'Today')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStart(today);
                setEnd(addDays(today, 6));
              }}
            >
              {t('challenges.weekPreset', '7 days from today')}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="challenge-start">
                {t('challenges.start', 'Start date')}
              </Label>
              <Input
                id="challenge-start"
                type="date"
                min={today}
                max={addDays(today, 366)}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="challenge-end">
                {t('challenges.end', 'End date')}
              </Label>
              <Input
                id="challenge-end"
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              'challenges.dateHint',
              'Both dates count. Choose between 1 and 366 days.'
            )}
          </p>
        </fieldset>
      )}
      <details className="rounded-2xl border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t('challenges.timezone', 'Challenge timezone')}: {timezone}
        </summary>
        <div className="mt-4 space-y-3">
          <TimezoneSelect
            value={timezone}
            onValueChange={(value) => {
              if (challengeTimezoneSchema.safeParse(value).success)
                setTimezone(value);
            }}
          />
          <p className="text-sm text-muted-foreground">
            {goalMode || !['steps', 'workout_time'].includes(metric)
              ? t('challenges.metricHint', {
                  defaultValue:
                    'Only the chosen daily aggregate is shared after acceptance. Personal targets are confirmed in the lobby and lock when everyone is Ready.',
                })
              : metric === 'workout_time'
                ? t('challenges.workoutTimezoneHint', {
                    defaultValue:
                      'This sets when the Challenge starts and ends. Workouts keep their existing daily date buckets.',
                  })
                : t(
                    'challenges.timezoneHint',
                    'This sets when the Challenge starts and ends. Steps keep their existing daily date buckets.'
                  )}
          </p>
        </div>
      </details>
      {draft && (
        <p role="status" className="rounded-2xl bg-muted p-4">
          {t(
            'challenges.rematchReview',
            'Review your rematch. Everyone you invite will choose whether to join again.'
          )}
        </p>
      )}
      {!!draft?.omitted && (
        <p role="status">
          {t(
            'challenges.rematchOmitted',
            'Some previous participants are no longer eligible and have not been selected.'
          )}
        </p>
      )}
      <ChallengeInvitees selected={selected} onChange={setSelected} />
      <div className="space-y-3 rounded-3xl bg-muted/50 p-5">
        <h2 className="font-semibold">
          {t('challenges.review', 'Ready to go?')}
        </h2>
        {createChallengeRequestSchema.safeParse({
          name,
          start_date: start,
          end_date: end,
          timezone,
        }).success && (
          <p>
            {day(start)} – {day(end)}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {goalMode || !['steps', 'workout_time'].includes(metric)
            ? t('challenges.metricHint', {
                defaultValue:
                  'Only the chosen daily aggregate is shared after acceptance. Personal targets are confirmed in the lobby and lock when everyone is Ready.',
              })
            : metric === 'workout_time'
              ? t('challenges.workoutConsent', {
                  defaultValue:
                    'You join automatically. Invited people must accept before aggregate workout time is shared. Dates and rules cannot be changed after creation.',
                })
              : t(
                  'challenges.createConsent',
                  'You join automatically. Invited people must accept before their steps are shared. Dates and rules cannot be changed after creation.'
                )}
        </p>
      </div>
      {validationError && (
        <p role="alert" className="text-destructive">
          {t(
            'challenges.invalidForm',
            'Enter a name of 1–100 characters and a valid 1–366 day range starting today or within the next year.'
          )}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-destructive">
          {t(
            'challenges.actionError',
            'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.'
          )}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? t('challenges.saving', 'Saving…')
          : t('challenges.create', 'Create Challenge')}
      </Button>
    </form>
  );
}
