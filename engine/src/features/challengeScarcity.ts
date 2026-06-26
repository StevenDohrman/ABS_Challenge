/**
 * Challenge Scarcity
 *
 * Models the opportunity cost of using a challenge.
 *
 * Each team has a finite number of challenges per game (2 under the current ABS
 * rules, and a successful challenge is retained — so the count can hold steady
 * all game). Using a challenge on a low-EV situation risks having none left for
 * a high-EV situation later. This module penalizes challenge use based on how
 * many challenges remain.
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
 * 0 challenges remaining returns the "none" level with no penalty: the engine
 * produces a value-based recommendation regardless of availability so that a
 * high-value call a team cannot challenge still surfaces as a missed opportunity.
 * Whether the team can actually challenge is tracked by the backend, not here.
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
   *   2+ challenges:  0  (no penalty — a full allotment, spend freely)
   *   1 challenge:   20  (significant caution — save it for a great spot)
   *   0 challenges:   0  (no penalty — show the call's raw value for auditing)
   */
  thresholdShift: number;

  /**
   * How many points to ADD to the minimum confidence required.
   * Stacks on top of the base confidence from the score.
   *
   *   2+ challenges:  0
   *   1 challenge:   15
   *   0 challenges:   0  (no penalty — show the call's raw value for auditing)
   */
  confidenceShift: number;

  /** Convenience label for explanation generation. */
  scarcityLevel: "plenty" | "moderate" | "scarce" | "none";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Computes the scarcity profile for the given number of challenges remaining.
 *
 * 0 (or fewer) returns the "none" level with no shifts; the recommendation
 * remains value-based and availability is handled outside the engine.
 */
export function computeChallengeScarcity(
  challengesRemaining: number
): ChallengeScarcityResult {
  if (challengesRemaining <= 0) {
    return {
      challengesRemaining,
      thresholdShift: 0,
      confidenceShift: 0,
      scarcityLevel: "none",
    };
  }

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
