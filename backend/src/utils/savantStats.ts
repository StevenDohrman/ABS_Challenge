/**
 * Derive OBP/OPS for engine offensive value from Savant season statlines.
 * Savant does not export OBP/OPS directly on the expected-stats leaderboard.
 */

export function deriveObpOpsFromSavant(
  ba: number | null,
  slg: number | null,
  woba: number | null,
  bbPercent: number | null
): { obp: number | null; ops: number | null } {
  const bbRate =
    bbPercent !== null && Number.isFinite(bbPercent) ? bbPercent / 100 : null;

  let obp: number | null = null;
  if (ba !== null && bbRate !== null) {
    // Simplified OBP proxy: BA + walk rate (ignores HBP/SF).
    obp = ba + bbRate;
  } else if (woba !== null) {
    obp = woba * 0.92;
  }

  let ops: number | null = null;
  if (obp !== null && slg !== null) {
    ops = obp + slg;
  } else if (woba !== null && slg !== null) {
    ops = woba * 0.92 + slg;
  } else if (woba !== null) {
    ops = woba * 2.31;
  }

  return { obp, ops };
}
