/**
 * Challenge Scarcity
 *
 * Models the opportunity cost of using a challenge.
 *
 * Each team has a finite number of challenges per game (typically 3 but can
 * vary). Using a challenge on a low-EV situation risks having no challenges
 * left for a high-EV situation later in the game. This module penalizes
 * challenge use based on how many challenges remain.
 *
 * Scarcity affects the engine in two ways:
 *
 *   1. Threshold shift — the score required to earn each recommendation label
 *      is raised when challenges are scarce. With 1 challenge left, the engine
 *      demands much stronger EV before recommending AUTO_ALLOW or ALLOW.
 *
 *   2. Minimum confidence adjustment — the player must express more confidence
 *      before the engine endorses spending a scarce challenge.
 *
 * These adjustments are NOT applied directly inside this module; this module
 * only computes the scarcity level and shift values. The decision layer
 * (thresholds.ts) applies them.
 *
 * 0 challenges remaining is a hard gate and never reaches this module
 * (the engine short-circuits to DENY before computing anything).
 */

import { SCARCITY } from "../constants";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ChallengeScarcityResult {
  /** How many challenges remain. */
  challengesRemaining: number;

  /**
   * How many points to ADD to score thresholds.
   * A positive shift makes it harder to reach AUTO_ALLOW, ALLOW, or WARN.
   *
   *   3 challenges:  0  (no penalty — spend freely)
   *   2 challenges:  8  (mild caution)
   *   1 challenge:  20  (significant caution — save it for a great spot)
   */
  thresholdShift: number;

  /**
   * How many points to ADD to the minimum confidence required.
   * Stacks on top of the base confidence from the score.
   *
   *   3 challenges:  0
   *   2 challenges:  5
   *   1 challenge:  15
   */
  confidenceShift: number;

  /** Convenience label for explanation generation. */
  scarcityLevel: "plenty" | "moderate" | "scarce";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Computes the scarcity profile for the given number of challenges remaining.
 * Callers should check for 0 challenges and short-circuit to DENY before
 * calling this function — behavior with 0 is undefined here.
 */
export function computeChallengeScarcity(
  challengesRemaining: number
): ChallengeScarcityResult {
  if (challengesRemaining >= SCARCITY.PLENTY_MIN_CHALLENGES) {
    return {
      challengesRemaining,
      thresholdShift: 0,
      confidenceShift: 0,
      scarcityLevel: "plenty",
    };
  }

  if (challengesRemaining === SCARCITY.MODERATE_CHALLENGES) {
    return {
      challengesRemaining,
      thresholdShift: SCARCITY.MODERATE_THRESHOLD_SHIFT,
      confidenceShift: SCARCITY.MODERATE_CONFIDENCE_SHIFT,
      scarcityLevel: "moderate",
    };
  }

  // SCARCITY.SCARCE_CHALLENGES (1) remaining
  return {
    challengesRemaining,
    thresholdShift: SCARCITY.SCARCE_THRESHOLD_SHIFT,
    confidenceShift: SCARCITY.SCARCE_CONFIDENCE_SHIFT,
    scarcityLevel: "scarce",
  };
}
