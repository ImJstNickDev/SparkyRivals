/** Presentation only: scores stay integer seconds; retain seconds so unequal
 * server scores are not displayed as an apparent tie. Native clients mirror this
 * with their platform unit formatters. No scoring or ranking happens here. */
export function formatChallengeDuration(
  seconds: number,
  locale: string,
): string {
  const value = Math.max(0, Math.trunc(seconds));
  const parts: Array<[number, "hour" | "minute" | "second"]> = [
    [Math.floor(value / 3600), "hour"],
    [Math.floor(value / 60) % 60, "minute"],
    [value % 60, "second"],
  ];
  return (
    parts
      .filter(([count]) => count > 0)
      .map(([count, unit]) =>
        new Intl.NumberFormat(locale, {
          style: "unit",
          unit,
          unitDisplay: "narrow",
        }).format(count),
      )
      .join(" ") ||
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "minute",
      unitDisplay: "narrow",
    }).format(0)
  );
}
