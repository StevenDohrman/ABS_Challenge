/**
 * MLB official-date helpers — keep in sync with backend/src/utils/mlbDates.ts.
 */

/** Conservative ET offset (UTC-5) for MLB official game dates. */
export const MLB_ET_OFFSET_MINUTES = -5 * 60;

export function mlbToday(nowMs: number = Date.now()): string {
  const etMs = nowMs + MLB_ET_OFFSET_MINUTES * 60 * 1_000;
  return new Date(etMs).toISOString().slice(0, 10);
}
