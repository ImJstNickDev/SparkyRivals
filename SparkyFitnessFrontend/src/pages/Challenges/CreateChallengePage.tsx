import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  prepareChallengeRematch,
  type ChallengeMetric,
  type ChallengeScoringMode,
  parseDecimalInput,
  type ChallengeRematchDraft,
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeTimezoneSchema,
} from '@workspace/shared';
import { UnsavedFormGuard } from '@/hooks/useUnsavedFormGuard';
import { ChallengeTypePicker } from './ChallengeTypePicker';
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
  const { actor, enabled } = useChallengeIdentity();
  const [params] = useSearchParams();
  const rematchId = params.get('rematch');
  return (
    <ChallengeShell back>
      {enabled &&
        (rematchId ? (
          <RematchForm key={`${actor}:${rematchId}`} id={rematchId} />
        ) : (
          <CreateForm key={actor} defaultTimezone={preferences.timezone} />
        ))}
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
  const [metric, setMetric] = useState<ChallengeMetric>(
    draft?.metric ?? 'steps'
  );
  const [scoring_mode, setMode] = useState<ChallengeScoringMode>(
    draft?.scoring_mode ?? 'sum'
  );
  const goalMode = scoring_mode !== 'sum';
  const [duration, setDuration] = useState(String(draft?.duration_days ?? 7));
  const [nextDay, setNextDay] = useState(draft?.start_next_day ?? false);
  const { t } = useChallengeFormat(metric, scoring_mode);
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initial] = useState(() =>
    JSON.stringify({
      metric,
      scoring_mode,
      duration,
      nextDay,
      timezone,
      start,
      end,
      name,
      selected,
    })
  );
  const dirty =
    initial !==
    JSON.stringify({
      metric,
      scoring_mode,
      duration,
      nextDay,
      timezone,
      start,
      end,
      name,
      selected,
    });
  const mutation = useChallengeMutation();
  const busy = useRef(false);
  const navigate = useNavigate();
  const today = todayInZone(timezone);
  useEffect(() => {
    if (created) navigate(`/challenges/${created}`, { replace: true });
  }, [created, navigate]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
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
    if (
      !parsed.success ||
      (!goalMode && (start < today || start > addDays(today, 366)))
    ) {
      const field = parsed.success
        ? 'start'
        : String(parsed.error.issues[0]?.path[0] ?? 'name');
      const id =
        field === 'duration_days'
          ? 'duration'
          : field === 'start_date'
            ? 'start'
            : field === 'end_date'
              ? 'end'
              : field;
      setValidationError(id);
      form.current?.querySelector<HTMLElement>(`#challenge-${id}`)?.focus();
      return;
    }
    setValidationError(null);
    busy.current = true;
    setSaving(true);
    try {
      const result = await mutation.mutateAsync({
        action: 'create',
        body: parsed.data,
      });
      if (result) setCreated(result.challenge.id);
    } catch {
      /* Remain on the form; no offline success or queued action. */
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <form
      ref={form}
      onSubmit={(event) => void submit(event)}
      className="mx-auto max-w-2xl space-y-7"
      noValidate
    >
      <UnsavedFormGuard dirty={!created && dirty} saving={saving} />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('challenges.create', { defaultValue: 'Create Challenge' })}
        </h1>
      </header>
      <fieldset disabled={saving} className="space-y-6">
        <ChallengeTypePicker
          metric={metric}
          mode={scoring_mode}
          onChange={(nextMetric, nextMode) => {
            setMetric(nextMetric);
            setMode(nextMode);
          }}
        />
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
            aria-invalid={validationError === 'name'}
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
              inputMode="numeric"
              aria-invalid={validationError === 'duration'}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {[3, 7, 14].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant={duration === String(days) ? 'default' : 'outline'}
                  onClick={() => setDuration(String(days))}
                >
                  {t('challenges.ux.duration', {
                    count: days,
                    defaultValue: '{{count}} days',
                    defaultValue_one: '{{count}} day',
                  })}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={nextDay}
                onChange={(event) => setNextDay(event.target.checked)}
              />
              {t('challenges.nextDay', 'Start on next full day')}
            </label>
            <p className="text-sm text-muted-foreground">
              {nextDay
                ? t('challenges.ux.nextDay', {
                    defaultValue: 'Starts the day after everyone is ready.',
                  })
                : t('challenges.ux.todayIncluded', {
                    defaultValue:
                      "Starts when everyone is ready. That day's earlier activity counts too.",
                  })}
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
        <details>
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
      </fieldset>
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
        disabled={saving || !!created}
      >
        {mutation.isPending
          ? t('challenges.saving', 'Saving…')
          : t('challenges.create', 'Create Challenge')}
      </Button>
    </form>
  );
}
