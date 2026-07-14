/**
 * Explanation-builder thresholds — when a situation or multiplier is
 * "unremarkable" enough to omit from the narrative.
 */
export const EXPLANATION = {
  /** Below this inning leverage, the game is considered early/low-stakes. */
  LOW_INNING_LEVERAGE: 0.75,

  /** Below this run-diff leverage, the score gap is comfortable. */
  LOW_RUN_DIFF_LEVERAGE: 0.80,

  /** Multipliers within this delta of 1.0 are treated as negligible. */
  NEGLIGIBLE_MULTIPLIER_DELTA: 0.02,
} as const;
