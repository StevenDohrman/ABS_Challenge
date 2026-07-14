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
 *      When the batting team is trailing, the gap is reduced by "rally potential":
 *      runners already on base plus RE24 for the current base/out state. Down 4
 *      with the bases loaded is treated as reachable (could tie this inning), not
 *      the same as down 4 with the bases empty.
 *
 * Final weight = clamp(inningLeverage × runDiffLeverage, WEIGHT_MIN, WEIGHT_MAX)
 */

import { GameStateContext } from "../domain/gameContext.types";
import { BASEBALL_RULES, SITUATION, SCARCITY } from "../constants";
import { lookupBaseRE } from "../data/runExpectancy";
import { clamp } from "../utils/clamp";

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
    /** Scoreboard gap before rally-potential adjustment (absolute). */
    rawRunGap: number;
    /** Gap after subtracting runners on base + inning RE when trailing. */
    effectiveRunGap: number | null;
    /** Use-it-or-lose-it boost when challenges remain in the 9th or later. */
    challengeUrgency: number;
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

  const { leverage: runDiffLeverage, rawRunGap, effectiveRunGap } =
    computeRunDiffLeverage(gameState);

  const challengeUrgency = computeChallengeUrgency(
    gameState.inning,
    gameState.challengesRemaining
  );

  const weight = clamp(
    inningLeverage * runDiffLeverage * challengeUrgency,
    SITUATION.WEIGHT_MIN,
    SITUATION.WEIGHT_MAX
  );

  const absRunDiff = Math.abs(gameState.runDifferentialForBattingTeam);

  return {
    weight,
    components: {
      inningLeverage,
      runDiffLeverage,
      rawRunGap,
      effectiveRunGap,
      challengeUrgency,
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

interface RunDiffLeverageResult {
  leverage: number;
  rawRunGap: number;
  /** Set when trailing and rally potential was evaluated. */
  effectiveRunGap: number | null;
}

/**
 * Returns a leverage multiplier based on how close the game is.
 *
 * Uses RUN_DIFF_LEVERAGE_BY_GAP indexed by the absolute run gap (0–4).
 * Gaps of 5 or more runs use RUN_DIFF_LEVERAGE_BLOWOUT.
 *
 * When trailing, the gap is first reduced by rally potential (runners on base
 * plus RE24 from the current state) so a deficit that could be erased this
 * inning is not discounted like a distant blowout.
 */
function computeRunDiffLeverage(
  gameState: GameStateContext
): RunDiffLeverageResult {
  const runDiff = gameState.runDifferentialForBattingTeam;
  const rawRunGap = Math.abs(runDiff);

  if (runDiff >= 0) {
    return {
      leverage: leverageForRunGap(rawRunGap),
      rawRunGap,
      effectiveRunGap: null,
    };
  }

  const runners = {
    first: gameState.runnerOnFirst,
    second: gameState.runnerOnSecond,
    third: gameState.runnerOnThird,
  };
  const runnersOnBase =
    Number(runners.first) + Number(runners.second) + Number(runners.third);

  if (runnersOnBase === 0) {
    return {
      leverage: leverageForRunGap(rawRunGap),
      rawRunGap,
      effectiveRunGap: null,
    };
  }

  const rallyPotential = runnersOnBase + lookupBaseRE(gameState.outs, runners);
  const effectiveRunGap = Math.max(0, rawRunGap - rallyPotential);

  return {
    leverage: leverageForRunGap(effectiveRunGap),
    rawRunGap,
    effectiveRunGap,
  };
}

function leverageForRunGap(absGap: number): number {
  const index = Math.floor(absGap);
  return (
    SITUATION.RUN_DIFF_LEVERAGE_BY_GAP[index] ??
    SITUATION.RUN_DIFF_LEVERAGE_BLOWOUT
  );
}

/**
 * Boosts urgency in the final inning(s) when the batting team still has
 * challenges to spend — wrong calls are costlier when there are few at-bats left.
 */
function computeChallengeUrgency(
  inning: number,
  challengesRemaining: number
): number {
  if (
    inning < SITUATION.LATE_INNING_CHALLENGE_URGENCY ||
    challengesRemaining <= 0
  ) {
    return 1;
  }

  if (challengesRemaining >= SCARCITY.PLENTY_MIN_CHALLENGES) {
    return 1 + SITUATION.CHALLENGE_URGENCY_BONUS_WITH_TWO;
  }

  return 1 + SITUATION.CHALLENGE_URGENCY_BONUS_WITH_ONE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
