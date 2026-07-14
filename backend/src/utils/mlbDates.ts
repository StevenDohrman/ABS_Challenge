/**
 * MLB official-date helpers (conservative Eastern Time offset).
 * Shared by schedule, rankings, and retention logic.
 */

/**
 * ET is UTC-4 (EDT) or UTC-5 (EST). Use -5 as a conservative offset so we
 * never accidentally advance to the next official game date too early.
 */
export const MLB_ET_OFFSET_MINUTES = -5 * 60;

/** MLB uses Eastern Time for official game dates. */
export function mlbToday(nowMs: number = Date.now()): string {
  const etMs = nowMs + MLB_ET_OFFSET_MINUTES * 60 * 1_000;
  return new Date(etMs).toISOString().slice(0, 10);
}

export function mlbDateAdd(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatRollingWindowLabel(
  periodStart: string,
  periodEnd: string,
  windowDays: number
): string {
  const startFmt = new Date(`${periodStart}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFmt = new Date(`${periodEnd}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Last ${windowDays} days (${startFmt} – ${endFmt})`;
}
