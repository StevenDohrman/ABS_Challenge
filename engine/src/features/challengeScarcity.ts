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
  challengesRemaining: number;

  /**
   * How many points to ADD to score thresholds.
   *
   *   2+ challenges:   0  (full allotment — spend freely)
   *   moderate tier:  8  (between scarce and plenty; unreachable with 2-challenge allotment)
   *   1 challenge:  14  (significant caution)
   *   0 challenges:   0  (no penalty — audit raw value)
   */
  thresholdShift: number;

  /**
   * How many points to ADD to the minimum confidence required.
   *
   *   2+ challenges:   0
   *   moderate tier:  5
   *   1 challenge:  15
   *   0 challenges:   0
   */
  confidenceShift: number;

  scarcityLevel: "plenty" | "moderate" | "scarce" | "none";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Computes the scarcity profile for the given number of challenges remaining.
 *
 * Tier order (highest remaining first):
 *   plenty   — remaining >= PLENTY_MIN_CHALLENGES (2 under current ABS rules)
 *   moderate — remaining between SCARCE and PLENTY (unreachable when allotment is 2)
 *   scarce   — exactly SCARCE_CHALLENGES (1)
 *   none     — remaining <= 0
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

  if (challengesRemaining === SCARCITY.SCARCE_CHALLENGES) {
    return {
      challengesRemaining,
      thresholdShift: SCARCITY.SCARCE_THRESHOLD_SHIFT,
      confidenceShift: SCARCITY.SCARCE_CONFIDENCE_SHIFT,
      scarcityLevel: "scarce",
    };
  }

  // Between scarce and plenty — active when allotment exceeds PLENTY_MIN.
  return {
    challengesRemaining,
    thresholdShift: SCARCITY.MODERATE_THRESHOLD_SHIFT,
    confidenceShift: SCARCITY.MODERATE_CONFIDENCE_SHIFT,
    scarcityLevel: "moderate",
  };
}
