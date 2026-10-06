import { useEffect, useState } from 'react';
import {
  addDays,
  todayInZone,
  challengeDateRange,
  challengeUpdateAge,
  type ChallengeResponse,
} from '@workspace/shared';
import { useChallengeFormat } from './presentation';

function useChallengeClock(timestamp?: string) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      const time = Date.now();
      setNow(time);
      timer = setTimeout(
        tick,
        timestamp && time - new Date(timestamp).getTime() < 60000 ? 1000 : 60000
      );
    };
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [timestamp]);
  return now;
}
export function ChallengeDates({
  challenge,
}: {
  challenge: ChallengeResponse;
}) {
  const { t, locale } = useChallengeFormat();
  useChallengeClock();
  const projected = !challenge.start_date || !challenge.end_date;
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
    <p className="text-sm text-muted-foreground">
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
    </p>
  );
}
export function ChallengeUpdated({ timestamp }: { timestamp: string }) {
  const { t, locale } = useChallengeFormat();
  const now = useChallengeClock(timestamp);
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t('challenges.ux.updatedRelative', {
        defaultValue: 'Updated {{time}}',
        time: challengeUpdateAge(timestamp, now, locale, t),
      })}
    </p>
  );
}
