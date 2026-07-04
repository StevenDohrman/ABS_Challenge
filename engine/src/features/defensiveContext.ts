/**
 * Defensive Context Multiplier
 *
 * Computes a small RE-delta multiplier (clamped to ±10%) from two signals:
 *
 *   1. Batter spray profile (GB/FB/LD rate deviations from league average)
 *      — always applied when spray data is available; reflects batted-ball type
 *      BABIP independently of any specific fielder.
 *
 *   2. Fielder OAA (Outs Above Average for the fielder covering the batter's
 *      primary spray zone) — applied on top of the spray component when
 *      specific fielder data is available from the live defensive lineup.
 *      Positive OAA → that fielder converts more plays than average → slight
 *      penalty for extending the at-bat.  Negative OAA → slight bonus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Null safety
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * - sprayProfile == null  → sprayAdj = 0   (no spray adjustment)
 * - fielderOaa == null    → oaaAdj   = 0   (no fielder adjustment)
 * - Both null             → multiplier = 1.0× (no change, same as pre-v1)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Fielder OAA source
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The relevant fielder is identified in the backend (challengeService) by
 * combining the batter's spray tendency + batting hand to determine the
 * primary defensive position, then looking up that fielder's ID from the live
 * defensive lineup (linescore.defense in the MLB feed) and querying the
 * fielder_oaa table.  The OAA is pre-selected for the correct batter handedness
 * split (oaaVsRhh / oaaVsLhh) before being stored in fielderOaa.
 */

import { PlayerChallengeContext } from "../domain/playerContext.types";
import { DEFENSIVE } from "../constants";
import { clamp } from "../utils/clamp";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface DefensiveContextResult {
  /**
   * Multiplier applied to the RE delta after the offensive value step.
   * Clamped to [DEFENSIVE.MIN_MULTIPLIER, DEFENSIVE.MAX_MULTIPLIER].
   * Returns exactly 1.0 when no spray or fielder data is available.
   */
  multiplier: number;

  /** Whether any spray or fielder data contributed to the adjustment. */
  sprayDataAvailable: boolean;

  /** Whether per-fielder OAA data was incorporated in the multiplier. */
  fielderOaaAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Computes the combined defensive context multiplier.
 *
 * Spray component: GB/FB/LD deviation from league average (reflects batted-
 * ball BABIP irrespective of specific fielder).
 *
 * Fielder OAA component: -fielderOaa × OAA_SCALE. A +10 OAA fielder covering
 * this batter's primary spray zone converts ~4% more plays into outs →
 * -4% on the multiplier; a -10 OAA fielder gives +4%.
 */
export function computeDefensiveContext(
  player: PlayerChallengeContext
): DefensiveContextResult {
  let sprayAdj = 0;
  let oaaAdj = 0;
  const sprayDataAvailable = !!player.sprayProfile;
  const fielderOaaAvailable =
    player.fielderOaa !== null && Number.isFinite(player.fielderOaa);

  // ── Spray component ────────────────────────────────────────────────────────
  if (player.sprayProfile) {
    const { gbPercent, fbPercent, ldPercent } = player.sprayProfile;

    if (gbPercent !== null && Number.isFinite(gbPercent)) {
      sprayAdj -= (gbPercent - DEFENSIVE.LEAGUE_AVG_GB_RATE) * DEFENSIVE.GB_SCALE;
    }
    if (fbPercent !== null && Number.isFinite(fbPercent)) {
      sprayAdj += (fbPercent - DEFENSIVE.LEAGUE_AVG_FB_RATE) * DEFENSIVE.FB_SCALE;
    }
    if (ldPercent !== null && Number.isFinite(ldPercent)) {
      sprayAdj += (ldPercent - DEFENSIVE.LEAGUE_AVG_LD_RATE) * DEFENSIVE.LD_SCALE;
    }
  }

  // ── Fielder OAA component ──────────────────────────────────────────────────
  // Positive OAA = elite defender in this batter's zone → fewer hits → penalty.
  // Negative OAA = poor defender → more hits → bonus.
  if (fielderOaaAvailable) {
    oaaAdj = -player.fielderOaa! * DEFENSIVE.OAA_SCALE;
  }

  const multiplier = clamp(
    1.0 + sprayAdj + oaaAdj,
    DEFENSIVE.MIN_MULTIPLIER,
    DEFENSIVE.MAX_MULTIPLIER
  );

  return { multiplier, sprayDataAvailable, fielderOaaAvailable };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
