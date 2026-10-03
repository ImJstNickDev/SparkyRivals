import { useTranslation } from 'react-i18next';
import type { ChallengeLifecycle } from '@workspace/shared';

export function useChallengeFormat() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  // Formatting a DATE, not converting a business day into a different zone.
  const day = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
  const statuses: Record<ChallengeLifecycle, string> = {
    active: t('challenges.active', 'Active'),
    upcoming: t('challenges.upcoming', 'Upcoming'),
    completed: t('challenges.completed', 'Completed'),
    cancelled: t('challenges.cancelled', 'Cancelled'),
  };
  return { t, number, day, statuses, locale };
}
