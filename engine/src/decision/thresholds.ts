/**
 * Recommendation Thresholds
 *
 * Converts a 0–100 score into a recommendation label and a minimum player
 * confidence requirement, with adjustments for challenge scarcity.
 *
 * Base thresholds (no scarcity penalty):
 *
 *   Score ≥ THRESHOLDS.AUTO_ALLOW  →  AUTO_ALLOW   (challenge without player input)
 *   Score ≥ THRESHOLDS.ALLOW       →  ALLOW        (challenge if player is confident)
 *   Score ≥ THRESHOLDS.WARN        →  WARN         (caution; only with strong confidence)
 *   Score < THRESHOLDS.WARN        →  DENY         (do not challenge)
 *
 * Scarcity raises all boundaries by scarcity.thresholdShift points.
 *
 * Minimum confidence required interpolates linearly within each zone:
 *   ALLOW zone: from ALLOW_CONFIDENCE_ENTRY (at zone bottom) to ALLOW_CONFIDENCE_EXIT (at top)
 *   WARN zone:  from WARN_CONFIDENCE_ENTRY  (at zone bottom) to WARN_CONFIDENCE_EXIT  (at top)
 *
 * All tunable values live in THRESHOLDS in constants.ts.
 */

import { ChallengeRecommendation } from "../domain/challengeDecision.types";
import { ChallengeScarcityResult } from "../features/challengeScarcity";
import { THRESHOLDS } from "../constants";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ThresholdResult {
  recommendation: ChallengeRecommendation;
  minimumPlayerConfidenceRequired: number;

  /** The effective thresholds after scarcity adjustment (exposed for explanation use). */
  effectiveThresholds: {
    autoAllow: number;
    allow: number;
    warn: number;
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function applyThresholds(
  score: number,
  scarcity: ChallengeScarcityResult
): ThresholdResult {
  const shift = scarcity.thresholdShift;

  const effectiveThresholds = {
    autoAllow: THRESHOLDS.AUTO_ALLOW + shift,
    allow: THRESHOLDS.ALLOW + shift,
    warn: THRESHOLDS.WARN + shift,
  };

  const recommendation = scoreToRecommendation(score, effectiveThresholds);
  const minimumPlayerConfidenceRequired = computeMinConfidence(
    score,
    recommendation,
    effectiveThresholds,
    scarcity.confidenceShift
  );

  return { recommendation, minimumPlayerConfidenceRequired, effectiveThresholds };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToRecommendation(
  score: number,
  thresholds: { autoAllow: number; allow: number; warn: number }
): ChallengeRecommendation {
  if (score >= thresholds.autoAllow) return "AUTO_ALLOW";
  if (score >= thresholds.allow) return "ALLOW";
  if (score >= thresholds.warn) return "WARN";
  return "DENY";
}

/**
 * Computes the minimum confidence a player must express before the engine
 * endorses spending a challenge. Higher score = lower confidence required.
 *
 * Within each recommendation zone, confidence required decreases linearly
 * from the zone entry boundary (lower score) to the zone exit boundary (higher score).
 *
 * AUTO_ALLOW: always 0 — engine recommends without player input.
 * ALLOW: interpolates from ALLOW_CONFIDENCE_ENTRY down to ALLOW_CONFIDENCE_EXIT.
 * WARN:  interpolates from WARN_CONFIDENCE_ENTRY  down to WARN_CONFIDENCE_EXIT.
 * DENY:  always 100 — engine will not endorse the challenge at any confidence.
 *
 * Scarcity adds confidenceShift to the result, raising the bar for spending
 * a scarce challenge.
 */
function computeMinConfidence(
  score: number,
  recommendation: ChallengeRecommendation,
  thresholds: { autoAllow: number; allow: number; warn: number },
  confidenceShift: number
): number {
  let base: number;

  switch (recommendation) {
    case "AUTO_ALLOW":
      return 0;

    case "ALLOW": {
      const zoneWidth = thresholds.autoAllow - thresholds.allow;
      const positionInZone = score - thresholds.allow;
      const confidenceRange =
        THRESHOLDS.ALLOW_CONFIDENCE_ENTRY - THRESHOLDS.ALLOW_CONFIDENCE_EXIT;
      base = Math.round(
        THRESHOLDS.ALLOW_CONFIDENCE_ENTRY -
          (positionInZone / zoneWidth) * confidenceRange
      );
      break;
    }

    case "WARN": {
      const zoneWidth = thresholds.allow - thresholds.warn;
      const positionInZone = score - thresholds.warn;
      const confidenceRange =
        THRESHOLDS.WARN_CONFIDENCE_ENTRY - THRESHOLDS.WARN_CONFIDENCE_EXIT;
      base = Math.round(
        THRESHOLDS.WARN_CONFIDENCE_ENTRY -
          (positionInZone / zoneWidth) * confidenceRange
      );
      break;
    }

    case "DENY":
      return 100;
  }

  return Math.min(100, base + confidenceShift);
}
