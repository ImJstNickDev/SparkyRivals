import { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  addDays,
  todayInZone,
  type ChallengeResponse,
} from '@workspace/shared';
import { useChallengeFormat } from './ChallengeChrome';
import { challengeDateRange, challengeUpdateAge } from '@workspace/shared';

export function ChallengeDates({
  challenge,
}: {
  challenge: ChallengeResponse;
}) {
  const { t, locale } = useChallengeFormat();
  const projected = !challenge.start_date || !challenge.end_date;
  useChallengeClock(undefined, projected);
  const start =
    challenge.start_date ??
    addDays(todayInZone(challenge.timezone), challenge.start_next_day ? 1 : 0);
  const end =
    challenge.end_date ?? addDays(start, (challenge.duration_days ?? 1) - 1);
  const range = challengeDateRange(start, end, locale);
  const duration = t('challenges.ux.duration', {
    count: range.days,
    defaultValue: '{{count}} days',
    defaultValue_one: '{{count}} day',
  });
  return (
    <Text className="text-text-secondary text-sm">
      {projected
        ? t('challenges.ux.projectedDates', {
            defaultValue: 'Expected {{start}} – {{end}} ({{duration}})',
            ...range,
            duration,
          })
        : t('challenges.ux.datesAndDuration', {
            defaultValue: '{{start}} – {{end}} ({{duration}})',
            ...range,
            duration,
          })}
    </Text>
  );
}

/** Only this label ticks. Rendering never changes the authoritative source time. */
export function ChallengeUpdated({ timestamp }: { timestamp: string }) {
  const { t, locale } = useChallengeFormat();
  const now = useChallengeClock(timestamp);
  return (
    <Text className="text-text-secondary text-xs text-center">
      {t('challenges.ux.updatedRelative', {
        defaultValue: 'Updated {{time}}',
        time: challengeUpdateAge(timestamp, now, locale, t),
      })}
    </Text>
  );
}

function useChallengeClock(timestamp?: string, enabled = true) {
  const focused = useIsFocused();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!focused || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (AppState.currentState === 'active') {
        timer = setTimeout(
          tick,
          timestamp && current - new Date(timestamp).getTime() < 60_000
            ? 1000
            : 60_000
        );
      }
    };
    tick();
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') tick();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [focused, timestamp, enabled]);
  return now;
}
