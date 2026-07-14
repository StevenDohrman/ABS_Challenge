/**
 * MLB official-date helpers (conservative Eastern Time offset).
 * Keep in sync with backend/src/utils/mlbDates.ts.
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
