import type { ChallengeTranslator } from "./translator.ts";
import { daysBetween } from "../../utils/timezone.ts";
import type { ChallengeLeaderboardEntry } from "../../schemas/api/Challenges.api.zod.ts";

/** Display truncation only. Never use this precision to order or rank entries. */
export function challengePointPrecision(
  entries: readonly ChallengeLeaderboardEntry[],
  scale = 1_000_000,
): Map<string, number> {
  const divisor = BigInt(scale);
  const values = entries.map((entry) => ({
    id: entry.user_id,
    value: BigInt(
      entry.total_score_scaled ?? Math.trunc(entry.total_score * scale),
    ),
  }));
  return new Map(
    values.map((entry) => {
      let digits = 0;
      while (
        digits < 2 &&
        values.some(
          (other) =>
            other.id !== entry.id &&
            other.value !== entry.value &&
            (other.value * 10n ** BigInt(digits)) / divisor ===
              (entry.value * 10n ** BigInt(digits)) / divisor,
        )
      )
        digits++;
      return [entry.id, digits];
    }),
  );
}

export function formatChallengePoints(
  entry: Pick<ChallengeLeaderboardEntry, "total_score" | "total_score_scaled">,
  digits: number,
  locale: string,
  scale = 1_000_000,
): string {
  const value = BigInt(
    entry.total_score_scaled ?? Math.trunc(entry.total_score * scale),
  );
  const places = 10n ** BigInt(digits);
  const truncated = (value * places) / BigInt(scale);
  const whole = formatExactInteger(truncated / places, locale);
  const fraction = Number(truncated % places);
  if (!fraction) return whole;
  const parts = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: digits,
  }).formatToParts(fraction / Number(places));
  return (
    whole +
    parts
      .filter((part) => part.type === "decimal" || part.type === "fraction")
      .map((part) => part.value)
      .join("")
  );
}

/** Calendar strings stay calendar strings; display order comes from app locale. */
export function challengeDateRange(start: string, end: string, locale: string) {
  const crossYear = start.slice(0, 4) !== end.slice(0, 4);
  const formatter = new Intl.DateTimeFormat(locale, {
    day: crossYear ? "2-digit" : "numeric",
    month: crossYear ? "2-digit" : "short",
    ...(crossYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  });
  return {
    start: formatter.format(new Date(`${start}T12:00:00Z`)),
    end: formatter.format(new Date(`${end}T12:00:00Z`)),
    days: daysBetween(start, end) + 1,
  };
}

export function challengeUpdateAge(
  timestamp: string,
  now: number,
  locale: string,
  t: ChallengeTranslator,
): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds > 7 * 86400)
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(then);
  const count =
    seconds >= 86400
      ? Math.floor(seconds / 86400)
      : seconds >= 3600
        ? Math.floor(seconds / 3600)
        : seconds >= 60
          ? Math.floor(seconds / 60)
          : seconds;
  const number = new Intl.NumberFormat(locale).format(count);
  if (seconds >= 7 * 86400)
    return t("challenges.ux.weekAgo", { defaultValue: "1w ago" });
  if (seconds >= 2 * 86400)
    return t("challenges.ux.daysAgo", {
      count,
      number,
      defaultValue: "{{number}} days ago",
      defaultValue_one: "{{number}} day ago",
    });
  if (seconds >= 86400)
    return t("challenges.ux.yesterday", { defaultValue: "Yesterday" });
  if (seconds >= 3600)
    return t("challenges.ux.hoursAgo", {
      count,
      number,
      defaultValue: "{{number}}h ago",
    });
  if (seconds >= 60)
    return t("challenges.ux.minutesAgo", {
      count,
      number,
      defaultValue: "{{number}}m ago",
    });
  return t("challenges.ux.secondsAgo", {
    count,
    number,
    defaultValue: "{{number}}s ago",
  });
}

/** Hermes Intl cannot accept BigInt. Group arbitrarily large nonnegative integers
 * with the locale's own grouping/digits, without passing them through Number. */
function formatExactInteger(value: bigint, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  if (value <= BigInt(Number.MAX_SAFE_INTEGER))
    return formatter.format(Number(value));
  const parts = formatter.formatToParts(123456789012345);
  const integers = parts
    .filter((part) => part.type === "integer")
    .map((part) => [...part.value].length);
  const separator = parts.find((part) => part.type === "group")?.value;
  const digits = Array.from(
    { length: 10 },
    (_, i) =>
      formatter.formatToParts(i).find((p) => p.type === "integer")!.value,
  );
  let remaining = value.toString();
  const groups: string[] = [];
  let width = integers.at(-1) ?? remaining.length;
  while (separator && remaining.length > width) {
    groups.unshift(remaining.slice(-width));
    remaining = remaining.slice(0, -width);
    width = integers.at(-2) ?? width;
  }
  groups.unshift(remaining);
  return groups
    .map((group) => [...group].map((d) => digits[Number(d)]).join(""))
    .join(separator ?? "");
}
