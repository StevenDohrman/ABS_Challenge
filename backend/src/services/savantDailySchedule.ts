/**
 * Decide whether SavantDailyJob should run now or wait out the remainder
 * of the 24-hour freshness window, based on last successful persist time.
 */

export function msUntilNextSavantDaily(
  lastRunAt: Date | null,
  now: Date,
  intervalMs: number
): number {
  if (!lastRunAt) return 0;
  const elapsed = now.getTime() - lastRunAt.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= intervalMs) {
    return 0;
  }
  return intervalMs - elapsed;
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
