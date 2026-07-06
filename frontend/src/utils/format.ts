/** Signed run-expectancy value with unit, e.g. "+1.23 RE". */
export function formatRe(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} RE`;
}

/** Signed decimal without unit, e.g. "+1.23". */
export function formatSignedDecimal(value: number, decimals = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

/** Percentage from a 0–1 rate; null → em dash. */
export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** Scheduled start time from ISO string. */
export function formatScheduledTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Live refresh / event timestamp (hour:minute:second am/pm). */
export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}
