import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import {
  CHALLENGE_METRIC_UNITS,
  acknowledgeChallengeTarget,
  challengeTargetInput,
  challengeTargetSchema,
  type ChallengeDetailResponse,
  type ChallengeParticipantResponse,
} from '@workspace/shared';
import { getCompanionChallengeSession } from '../../services/companionChallengeSession';
import { useChallengeMutation } from '../../hooks/useChallenges';
import { challengeDisplayUnitText } from '@workspace/shared';
import { parseDecimalInput } from '../../utils/numericInput';
import FormInput from '../FormInput';
import Button from '../ui/Button';
import { ChallengeMutationError, useChallengeFormat } from './ChallengeChrome';

/** Saves on blur/back, serializes with Ready, and keeps an acknowledged revision. */
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
  const [input] = useState(() =>
    challengeTargetInput(challenge.metric, displayPreferences)
  );
  const inputUnit = challengeDisplayUnitText(t, input.unit);
  const formatInput = (v: number | null) =>
    v == null
      ? ''
      : new Intl.NumberFormat(locale, {
          useGrouping: false,
          maximumFractionDigits: 6,
        }).format(v / input.factor);
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
  const [session] = useState(getCompanionChallengeSession);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () =>
    mounted.current &&
    !session.blocked &&
    getCompanionChallengeSession() === session;
  const mutation = useChallengeMutation();
  const navigation = useNavigation();
  const canonical = edited
    ? Math.round(parseDecimalInput(value) * input.factor * 1_000_000) /
      1_000_000
    : (ack.value ?? suggested ?? NaN);
  const dirty = edited && canonical !== ack.value;
  const conflict = !busy && ack.revision !== (own.target_revision ?? 0);
  const label = t('challenges.dailyTarget', {
    defaultValue: 'Your daily target ({{unit}})',
    unit: inputUnit,
  });

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
        const result = await mutation.mutateAsync({
          action: 'target',
          id: challenge.id,
          target: parsed.data,
          revision: acknowledged.current.revision,
        });
        if (!current()) return false;
        if (!result) throw new Error('CHALLENGE_RECONFIRM_REQUIRED');
        acknowledged.current = acknowledgeChallengeTarget(
          result,
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
  usePreventRemove(current() && (dirty || busy), ({ data }) => {
    void save().then((saved) => {
      if (saved && current()) navigation.dispatch(data.action);
    });
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
  return (
    <View className="gap-3">
      {own.ready_at && canonical === own.target_value && !conflict ? (
        <>
          <Text
            accessibilityRole="header"
            className="text-text-primary text-2xl font-bold"
          >
            {t('challenges.ux.youReady', { defaultValue: "You're ready" })}
          </Text>
          <Text className="text-text-secondary">
            {own.target_value == null
              ? '—'
              : displayValue(
                  own.target_value,
                  CHALLENGE_METRIC_UNITS[challenge.metric]
                )}
          </Text>
          <Button
            accessibilityRole="button"
            variant="secondary"
            disabled={busy || mutation.isPending}
            onPress={() =>
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
          <Text
            accessibilityRole="header"
            className="text-text-primary text-xl font-semibold"
          >
            {label}
          </Text>
          <FormInput
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setEdited(true);
              setInvalid(false);
            }}
            onBlur={() => {
              if (edited) void save();
            }}
            editable={!busy}
          />
          {conflict && (
            <>
              <Text accessibilityRole="alert" className="text-text-secondary">
                {t('challenges.ux.reconfirm', {
                  defaultValue:
                    'Your saved target changed. Review it before confirming again.',
                })}
              </Text>
              <Button
                accessibilityRole="button"
                variant="secondary"
                onPress={() => {
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
            </>
          )}
          <Button
            accessibilityRole="button"
            loading={busy && readyPending.current}
            disabled={conflict}
            onPress={() => void ready()}
          >
            {t('challenges.ready', { defaultValue: 'Ready' })}
          </Button>
        </>
      )}
      {invalid && (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('challenges.invalidTarget', {
            defaultValue:
              'Enter a positive target with at most six decimal places in the canonical unit.',
          })}
        </Text>
      )}
      {readyFailed ? (
        <Text accessibilityRole="alert" className="text-icon-danger">
          {t('challenges.ux.readyFailed', {
            defaultValue:
              'Target saved. Ready was not confirmed. Review the saved target and try again.',
          })}
        </Text>
      ) : (
        (failed || mutation.isError) && <ChallengeMutationError />
      )}
    </View>
  );
}
