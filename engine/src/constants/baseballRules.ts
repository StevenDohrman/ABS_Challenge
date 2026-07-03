export const BASEBALL_RULES = {
  /** Ball count at which the batter draws a walk. */
  BALLS_FOR_WALK: 3,

  /** Strike count at which the batter strikes out (on the next strike). */
  STRIKES_FOR_STRIKEOUT: 2,

  /** Number of outs that end a half-inning. */
  OUTS_PER_INNING: 3,

  /** Last inning of a standard (non-extra-inning) game. */
  LAST_REGULAR_INNING: 9,
} as const;
