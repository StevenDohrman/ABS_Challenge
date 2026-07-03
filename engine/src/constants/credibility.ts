export const CREDIBILITY = {
  /**
   * Baseline probability that a challenged called strike was actually a ball,
   * before any player-specific adjustments are applied.
   */
  BASE_P_CALL_WRONG: 0.32,

  MIN_P_CALL_WRONG: 0.15,
  MAX_P_CALL_WRONG: 0.55,

  CHASE_WEIGHT: 0.50,
  WALK_WEIGHT: 0.20,
  STRIKEOUT_WEIGHT: 0.15,
  WHIFF_WEIGHT: 0.15,

  CHASE_SCALE: 0.40,
  WALK_SCALE: 0.90,
  STRIKEOUT_SCALE: 0.50,
  WHIFF_SCALE: 0.40,

  MAX_DISCIPLINE_ADJUSTMENT: 0.12,

  SAME_HAND_MODIFIER: -0.03,
  OPPOSITE_HAND_MODIFIER: 0.03,

  HISTORY_MIN_ATTEMPTS: 5,
  HISTORY_FULL_WEIGHT_ATTEMPTS: 20,
} as const;
