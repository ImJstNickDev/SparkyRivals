import { useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import {
  CHALLENGE_METRIC_UNITS,
  acknowledgeChallengeTarget,
  challengeDisplayUnitText,
  challengeTargetInput,
  challengeTargetSchema,
  parseDecimalInput,
  type ChallengeDetailResponse,
  type ChallengeParticipantResponse,
} from '@workspace/shared';
import {
  useChallengeIdentity,
  useChallengeMutation,
} from '@/hooks/Challenges/useChallenges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChallengeFormat } from './presentation';

/** Blur and route Back await the same save; Ready uses its acknowledged revision. */
export function ChallengeTargetForm({
  detail,
  own,
  suggested,
}: {
  detail: ChallengeDetailResponse;
  own: ChallengeParticipantResponse;
  suggested: number | null;
}) {
  const { challenge } = detail;
  const {
    t,
    locale,
    displayPreferences,
    value: displayValue,
  } = useChallengeFormat(challenge.metric, challenge.scoring_mode);
  const identity = useChallengeIdentity();
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () =>
    mounted.current &&
    currentIdentity.current.enabled &&
    currentIdentity.current.actor === own.user_id;
  const [input] = useState(() =>
    challengeTargetInput(challenge.metric, displayPreferences)
  );
  const formatInput = (value: number | null) =>
    value == null
      ? ''
      : new Intl.NumberFormat(locale, {
          useGrouping: false,
          maximumFractionDigits: 6,
        }).format(value / input.factor);
  const [value, setValue] = useState(() =>
    formatInput(own.target_value ?? suggested)
  );
  const [ack, setAck] = useState({
    value: own.target_value ?? null,
    revision: own.target_revision ?? 0,
  });
  const acknowledged = useRef(ack);
  const [edited, setEdited] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readyFailed, setReadyFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef<Promise<boolean> | null>(null);
  const readyPending = useRef(false);
  const mutation = useChallengeMutation();
  const canonical = edited
    ? Math.round(parseDecimalInput(value) * input.factor * 1_000_000) /
      1_000_000
    : (ack.value ?? suggested ?? NaN);
  const dirty = edited && canonical !== ack.value;
  const conflict = !busy && ack.revision !== (own.target_revision ?? 0);
  const save = (): Promise<boolean> => {
    if (saving.current) return saving.current;
    if (!current()) return Promise.resolve(false);
    const parsed = challengeTargetSchema.safeParse(canonical);
    setInvalid(!parsed.success);
    if (!parsed.success || conflict) return Promise.resolve(false);
    if (parsed.data === acknowledged.current.value)
      return Promise.resolve(true);
    setBusy(true);
    setFailed(false);
    setReadyFailed(false);
    const request = async () => {
      try {
        const response = await mutation.mutateAsync({
          action: 'target',
          id: challenge.id,
          target: parsed.data,
          revision: acknowledged.current.revision,
        });
        if (!current()) return false;
        if (!response) throw new Error('CHALLENGE_RECONFIRM_REQUIRED');
        acknowledged.current = acknowledgeChallengeTarget(
          response,
          own.user_id,
          parsed.data
        );
        setAck(acknowledged.current);
        return true;
      } catch {
        if (current()) setFailed(true);
        return false;
      } finally {
        saving.current = null;
        if (current()) setBusy(false);
      }
    };
    saving.current = request();
    return saving.current;
  };
  const blocker = useBlocker(current() && (dirty || busy));
  const saveLatest = useRef(save);
  saveLatest.current = save;
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let cancelled = false;
    void saveLatest.current().then((saved) => {
      if (cancelled) return;
      if (saved) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      cancelled = true;
    };
  }, [blocker]);
  useBeforeUnload((event) => {
    // Closing a tab cannot await a network save. Preserve the browser's leave warning.
    if (current() && (dirty || busy)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  const ready = async () => {
    if (readyPending.current || !current()) return;
    readyPending.current = true;
    const changed =
      canonical !== acknowledged.current.value || !!saving.current;
    try {
      if (!(await save()) || !current()) return;
      setBusy(true);
      setFailed(false);
      setReadyFailed(false);
      await mutation.mutateAsync({
        action: 'ready',
        id: challenge.id,
        ready: true,
        revision: acknowledged.current.revision,
      });
    } catch {
      if (current()) {
        setReadyFailed(changed);
        setFailed(true);
      }
    } finally {
      readyPending.current = false;
      if (current()) setBusy(false);
    }
  };
  const inputUnit = challengeDisplayUnitText(t, input.unit);
  return (
    <section className="max-w-md space-y-3" aria-busy={busy}>
      {own.ready_at && canonical === own.target_value && !conflict ? (
        <>
          <h2 className="text-2xl font-semibold">
            {t('challenges.ux.youReady', { defaultValue: "You're ready" })}
          </h2>
          <p className="text-muted-foreground">
            {own.target_value == null
              ? '—'
              : displayValue(
                  own.target_value,
                  CHALLENGE_METRIC_UNITS[challenge.metric]
                )}
          </p>
          <Button
            variant="outline"
            disabled={busy || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                action: 'ready',
                id: challenge.id,
                ready: false,
                revision: ack.revision,
              })
            }
          >
            {t('challenges.unready', { defaultValue: 'Not ready' })}
          </Button>
        </>
      ) : (
        <>
          <Label className="text-lg" htmlFor="challenge-target">
            {t('challenges.dailyTarget', {
              defaultValue: 'Your daily target ({{unit}})',
              unit: inputUnit,
            })}
          </Label>
          <Input
            id="challenge-target"
            inputMode="decimal"
            value={value}
            aria-invalid={invalid || conflict}
            aria-describedby={invalid || conflict ? 'target-error' : undefined}
            disabled={busy}
            onChange={(event) => {
              setValue(event.target.value);
              setEdited(true);
              setInvalid(false);
            }}
            onBlur={() => {
              if (edited) void save();
            }}
          />
          {conflict && (
            <div className="space-y-2">
              <p id="target-error" role="alert">
                {t('challenges.ux.reconfirm', {
                  defaultValue:
                    'Your saved target changed. Review it before confirming again.',
                })}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setValue(formatInput(own.target_value ?? null));
                  acknowledged.current = {
                    value: own.target_value ?? null,
                    revision: own.target_revision ?? 0,
                  };
                  setAck(acknowledged.current);
                  setEdited(false);
                  setFailed(false);
                  setInvalid(false);
                  mutation.reset();
                }}
              >
                {t('challenges.ux.reviewSaved', {
                  defaultValue: 'Use saved target',
                })}
              </Button>
            </div>
          )}
          <Button
            disabled={conflict || readyPending.current}
            onClick={() => void ready()}
          >
            {t('challenges.ready', { defaultValue: 'Ready' })}
          </Button>
        </>
      )}
      {invalid && (
        <p id="target-error" role="alert" className="text-sm text-destructive">
          {t('challenges.invalidTarget', {
            defaultValue:
              'Enter a positive target with at most six decimal places in the canonical unit.',
          })}
        </p>
      )}
      {readyFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('challenges.ux.readyFailed', {
            defaultValue:
              'Target saved. Ready was not confirmed. Review the saved target and try again.',
          })}
        </p>
      ) : (
        (failed || mutation.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {t('challenges.actionError', {
              defaultValue:
                'Could not save this change. Check your connection; membership or permissions may have changed. Try again after refreshing.',
            })}
          </p>
        )
      )}
    </section>
  );
}
