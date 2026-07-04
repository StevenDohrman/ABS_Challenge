/**
 * Offensive Value Multiplier
 *
 * The run expectancy table gives the average expected runs for the rest of the
 * inning from a given base/out/count state, assuming a league-average batter.
 * But the batter at the plate is not always league-average.
 *
 * Keeping an elite hitter at the plate by successfully challenging a called
 * strike is worth more than keeping a light-hitting backup at the plate,
 * because the elite hitter is more likely to convert that extra plate appearance
 * into a run.
 *
 * This module computes a small multiplier (clamped to [MIN_MULTIPLIER, MAX_MULTIPLIER])
 * applied to the run expectancy delta before the EV calculation. The multiplier
 * is based on the batter's OPS relative to league average:
 *
 *   OPS at league average (≈ .728) → multiplier = 1.00 (no adjustment)
 *   OPS significantly above average → multiplier up to MAX_MULTIPLIER (1.15)
 *   OPS significantly below average → multiplier down to MIN_MULTIPLIER (0.85)
 *
 * If OPS is null but OBP is available, OBP is used as a proxy (scaled to an
 * approximate OPS equivalent). If neither is available, the multiplier is 1.00
 * (no adjustment — the RE table's league-average assumption is left unchanged).
 */

import { PlayerChallengeContext } from "../domain/playerContext.types";
import { LeagueAverages } from "../domain/leagueContext.types";
import { OFFENSIVE } from "../constants";
import { scaleMultiplier } from "../utils/clamp";
import { OBP_TO_OPS_SCALE } from "../utils/conversion";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface OffensiveValueResult {
  multiplier: number;
  opsWasAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeOffensiveValue(
  player: PlayerChallengeContext,
  league: LeagueAverages
): OffensiveValueResult {
  const effectiveOps = resolveOps(player);

  if (effectiveOps === null) {
    return { multiplier: 1.0, opsWasAvailable: false };
  }

  const deviation = effectiveOps - league.ops;

  return {
    multiplier: scaleMultiplier(
      deviation,
      OFFENSIVE.OPS_DEVIATION_SCALE,
      OFFENSIVE.MIN_MULTIPLIER,
      OFFENSIVE.MAX_MULTIPLIER
    ),
    opsWasAvailable: player.ops !== null,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveOps(player: PlayerChallengeContext): number | null {
  if (player.ops !== null && Number.isFinite(player.ops)) return player.ops;
  if (player.obp !== null && Number.isFinite(player.obp)) {
    return player.obp * OBP_TO_OPS_SCALE;
  }
  return null;
}
