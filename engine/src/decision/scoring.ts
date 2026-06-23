/**
 * Score Normalization
 *
 * Converts the situation-adjusted expected value (in runs) to a 0–100 score.
 *
 * Important: for called-strike challenges, the run expectancy delta is always
 * positive — success (gaining a ball) always outperforms failure (gaining a
 * strike) in expected run terms. This means raw EV is never negative.
 *
 * However, a very small positive EV still does not justify spending a challenge,
 * because challenges are scarce and have opportunity cost. The normalization
 * therefore centers at BREAK_EVEN_EV rather than zero:
 *
 *   adjustedEV = BREAK_EVEN_EV          →  score = MIDPOINT (50)
 *   adjustedEV = BREAK_EVEN_EV + SCALE_EV  →  score = 100
 *   adjustedEV ≈ 0 (near-zero EV)       →  score ≈ 42–44 (below break-even)
 *
 * This allows DENY to be reached through the normal scoring path (not only
 * through hard gates) when low EV combined with scarcity threshold shifts
 * pushes the score below the effective WARN threshold.
 *
 * All tunable values live in SCORING in constants.ts.
 */

import { SCORING } from "../constants";

/**
 * Converts a situation-adjusted expected value (runs) to a 0–100 score.
 * Returns an integer.
 */
export function normalizeScore(adjustedEV: number): number {
  const raw =
    SCORING.MIDPOINT +
    ((adjustedEV - SCORING.BREAK_EVEN_EV) / SCORING.SCALE_EV) * SCORING.MIDPOINT;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
