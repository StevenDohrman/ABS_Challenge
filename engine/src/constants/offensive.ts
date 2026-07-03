export const OFFENSIVE = {
  /**
   * Maximum multiplier applied to the RE delta for an elite batter (high OPS).
   */
  MAX_MULTIPLIER: 1.15,

  /**
   * Minimum multiplier for a well-below-average batter (low OPS).
   */
  MIN_MULTIPLIER: 0.85,

  /** Each 0.100 OPS above/below average shifts the multiplier by ~0.05. */
  OPS_DEVIATION_SCALE: 0.50,
} as const;
