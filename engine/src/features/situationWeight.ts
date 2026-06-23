/**
 * Situation Weight
 *
 * Computes a leverage multiplier that scales the raw expected value of a
 * challenge based on how important the current game situation is.
 *
 * A challenge that adds 0.2 expected runs matters much more in the 9th inning
 * of a tie game than it does in the 1st inning of a blowout. This module
 * captures that difference without needing a full win-probability model.
 *
 * Two independent components:
 *
 *   1. Inning leverage — how far into the game we are.
 *      Ramps from INNING_LEVERAGE_MIN (inning 1) to INNING_LEVERAGE_MAX
 *      (inning 9+). Extra innings stay at maximum.
 *
 *   2. Run differential leverage — how close the game is.
 *      Runs matter most when the game is within reach. Indexed by absolute
 *      run gap; blowouts (≥ BLOWOUT_MIN_RUN_DIFF) receive the lowest leverage.
 *
 * Final weight = clamp(inningLeverage × runDiffLeverage, WEIGHT_MIN, WEIGHT_MAX)
 */

import { GameStateContext } from "../domain/gameContext.types";
import { BASEBALL_RULES, SITUATION } from "../constants";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface SituationWeightResult {
  /** Final combined multiplier applied to raw EV. */
  weight: number;

  /** Breakdown for explanation generation. */
  components: {
    inningLeverage: number;
    runDiffLeverage: number;
    isLateAndClose: boolean; // inning ≥ LATE_GAME_INNING and |runDiff| ≤ CLOSE_GAME_MAX_RUN_DIFF
    isBlowout: boolean;      // |runDiff| ≥ BLOWOUT_MIN_RUN_DIFF
    isExtraInnings: boolean; // inning > LAST_REGULAR_INNING
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function computeSituationWeight(
  gameState: GameStateContext
): SituationWeightResult {
  const inningLeverage = computeInningLeverage(
    gameState.inning,
    gameState.halfInning,
    gameState.runDifferentialForBattingTeam
  );

  const runDiffLeverage = computeRunDiffLeverage(
    gameState.runDifferentialForBattingTeam
  );

  const weight = clamp(
    inningLeverage * runDiffLeverage,
    SITUATION.WEIGHT_MIN,
    SITUATION.WEIGHT_MAX
  );

  const absRunDiff = Math.abs(gameState.runDifferentialForBattingTeam);

  return {
    weight,
    components: {
      inningLeverage,
      runDiffLeverage,
      isLateAndClose:
        gameState.inning >= SITUATION.LATE_GAME_INNING &&
        absRunDiff <= SITUATION.CLOSE_GAME_MAX_RUN_DIFF,
      isBlowout: absRunDiff >= SITUATION.BLOWOUT_MIN_RUN_DIFF,
      isExtraInnings: gameState.inning > BASEBALL_RULES.LAST_REGULAR_INNING,
    },
  };
}

// ---------------------------------------------------------------------------
// Inning leverage
// ---------------------------------------------------------------------------

/**
 * Returns a leverage multiplier based on how far into the game we are.
 *
 * Ramps linearly from INNING_LEVERAGE_MIN (inning 1) to INNING_LEVERAGE_MAX
 * (inning 9). Extra innings are capped at the maximum.
 *
 * Walk-off bonus: added when the home team is batting in the 9th or later
 * while tied or trailing by at most WALK_OFF_MAX_DEFICIT runs.
 */
function computeInningLeverage(
  inning: number,
  halfInning: "top" | "bottom",
  runDifferentialForBattingTeam: number
): number {
  const clampedInning = Math.min(inning, BASEBALL_RULES.LAST_REGULAR_INNING);
  const leverageRange =
    SITUATION.INNING_LEVERAGE_MAX - SITUATION.INNING_LEVERAGE_MIN;
  const leverageDenominator = BASEBALL_RULES.LAST_REGULAR_INNING - 1;

  const baseLeverage =
    SITUATION.INNING_LEVERAGE_MIN +
    ((clampedInning - 1) / leverageDenominator) * leverageRange;

  const isWalkOffTerritory =
    halfInning === "bottom" &&
    inning >= BASEBALL_RULES.LAST_REGULAR_INNING &&
    runDifferentialForBattingTeam >= SITUATION.WALK_OFF_MAX_DEFICIT &&
    runDifferentialForBattingTeam <= 0;

  return baseLeverage + (isWalkOffTerritory ? SITUATION.WALK_OFF_BONUS : 0);
}

// ---------------------------------------------------------------------------
// Run differential leverage
// ---------------------------------------------------------------------------

/**
 * Returns a leverage multiplier based on how close the game is.
 *
 * Uses RUN_DIFF_LEVERAGE_BY_GAP indexed by the absolute run gap (0–4).
 * Gaps of 5 or more runs use RUN_DIFF_LEVERAGE_BLOWOUT.
 *
 * The sign of the differential does not affect magnitude — being up 3 and
 * down 3 are equally "close" from a run-value standpoint.
 */
function computeRunDiffLeverage(runDifferentialForBattingTeam: number): number {
  const absGap = Math.abs(runDifferentialForBattingTeam);
  return (
    SITUATION.RUN_DIFF_LEVERAGE_BY_GAP[absGap] ??
    SITUATION.RUN_DIFF_LEVERAGE_BLOWOUT
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
