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
 *
 * The adjustment is intentionally small (±15% maximum) because:
 *   - The RE delta already captures the structural value of the situation.
 *   - Batter quality effects are partially embedded in team run environments.
 *   - Overcorrecting for batter quality could mask the situational signal.
 */

import { PlayerChallengeContext } from "../domain/playerContext.types";
import { LeagueAverages } from "../domain/leagueContext.types";
import { CREDIBILITY } from "../constants";

// OBP roughly correlates with OPS at about 1.8× (OPS ≈ OBP × 1.8 on average).
// Used to approximate OPS when only OBP is available.
const OBP_TO_OPS_SCALE = 1.8;

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface OffensiveValueResult {
  /**
   * Multiplier applied to the RE delta.
   * Clamped to [OFFENSIVE_VALUE_MIN_MULTIPLIER, OFFENSIVE_VALUE_MAX_MULTIPLIER].
   */
  multiplier: number;

  /** Whether OPS was available (true) or estimated from OBP / defaulted (false). */
  opsWasAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Returns a multiplier reflecting how much more (or less) valuable it is to
 * keep this specific batter's at-bat alive, relative to a league-average batter.
 *
 * @param league - Current-season league averages. The batter's OPS is compared
 *   against league.ops so the baseline reflects the current season, not a
 *   historical constant.
 */
export function computeOffensiveValue(
  player: PlayerChallengeContext,
  league: LeagueAverages
): OffensiveValueResult {
  const effectiveOps = resolveOps(player);

  if (effectiveOps === null) {
    return { multiplier: 1.0, opsWasAvailable: false };
  }

  const deviation = effectiveOps - league.ops;

  // Scale: each 0.100 OPS above/below average shifts the multiplier by ~0.05.
  // So a .900 OPS batter (0.172 above avg) → multiplier ≈ 1.086.
  // A .600 OPS batter (0.128 below avg) → multiplier ≈ 0.936.
  const rawMultiplier = 1.0 + deviation * 0.50;

  return {
    multiplier: clamp(
      rawMultiplier,
      CREDIBILITY.OFFENSIVE_VALUE_MIN_MULTIPLIER,
      CREDIBILITY.OFFENSIVE_VALUE_MAX_MULTIPLIER
    ),
    opsWasAvailable: player.ops !== null,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the batter's OPS (or a proxy from OBP) for the multiplier calculation.
 * Returns null if neither OPS nor OBP is available.
 */
function resolveOps(player: PlayerChallengeContext): number | null {
  if (player.ops !== null) return player.ops;
  if (player.obp !== null) return player.obp * OBP_TO_OPS_SCALE;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
