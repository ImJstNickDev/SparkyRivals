import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  todayInZone,
  createChallengeRequestSchema,
  challengeTimezoneSchema,
} from '@workspace/shared';
import { Footprints } from 'lucide-react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useChallengeMutation } from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimezoneSelect } from '@/pages/Settings/TimezoneSelect';
import { ChallengeInvitees } from './ChallengeInvitees';
import { ChallengeShell } from './ChallengeChrome';
import { useChallengeFormat } from './presentation';

export default function CreateChallengePage() {
  const preferences = usePreferences();
  return (
    <ChallengeShell back>
      <CreateForm
        key={preferences.timezone}
        defaultTimezone={preferences.timezone}
      />
    </ChallengeShell>
  );
}
function CreateForm({ defaultTimezone }: { defaultTimezone: string }) {
  const { t, day } = useChallengeFormat();
  const [timezone, setTimezone] = useState(
    defaultTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [start, setStart] = useState(todayInZone(timezone));
  const [end, setEnd] = useState(addDays(start, 6));
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
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
      start_date: start,
      end_date: end,
      timezone,
      participant_ids: selected,
    });
    if (!parsed.success || start < today || start > addDays(today, 366)) {
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
      <section className="flex items-center gap-4 rounded-3xl bg-primary/5 p-5">
        <Footprints aria-hidden className="h-9 w-9 shrink-0" />
        <div>
          <h2 className="font-semibold">
            {t('challenges.rules', 'Steps · Highest total wins')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
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
            {t(
              'challenges.timezoneHint',
              'This sets when the Challenge starts and ends. Steps keep their existing daily date buckets.'
            )}
          </p>
        </div>
      </details>
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
          {t(
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
