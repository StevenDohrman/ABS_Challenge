export const LEAGUE_AVERAGES = {
  /** Fraction of pitches outside the zone that the average batter swings at. */
  CHASE_RATE: 0.30,

  /** Walk rate (BB / PA) for an average MLB batter. */
  WALK_RATE: 0.085,

  /** Strikeout rate (K / PA) for an average MLB batter. */
  STRIKEOUT_RATE: 0.225,

  /** Whiff rate (swings and misses / total swings) for an average MLB batter. */
  WHIFF_RATE: 0.25,

  /** OPS for a league-average MLB batter. Used to normalize offensive value. */
  OPS: 0.728,
} as const;
