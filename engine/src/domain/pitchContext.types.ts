/**
 * Context about the specific pitch call being evaluated for a challenge.
 *
 * Deliberately minimal: the engine does NOT have access to pitch location data
 * (that is Savant territory, only available postgame). Everything here comes
 * from the live MLB feed or is inferred from live context.
 *
 * The two challengeable call types are:
 *   "called_strike" — batter challenges, believes it was a ball
 *   "ball"          — fielding team challenges, believes it was a strike
 *
 * In practice, batter challenges of called strikes are the primary use case.
 */
export interface PitchCallContext {
  /**
   * What the ABS system called on this pitch.
   * Only "called_strike" and "ball" are challengeable.
   * Swinging strikes, fouls, and balls in play cannot be challenged.
   */
  callType: "called_strike" | "ball";

  /**
   * The pitcher's throwing hand. Combined with the batter's stance, this
   * determines the relative handedness of the matchup:
   *
   *   Same-hand (RHP vs RHB, LHP vs LHB): pitcher throws away from batter.
   *     Pitches near the outer edge are harder to read — lower challenger credibility.
   *
   *   Opposite-hand (RHP vs LHB, LHP vs RHB): pitcher throws across the plate.
   *     Edge pitches are more visible to the batter — higher challenger credibility.
   *
   * Null when handedness is unknown.
   */
  pitcherHandedness: "L" | "R" | null;

  /**
   * Raw call code from the MLB live feed (e.g. "C" for called strike).
   * Passed through for logging and debugging only — not used in calculations.
   */
  callCode?: string;

  /**
   * Human-readable call description from the MLB live feed.
   * Passed through for logging and debugging only — not used in calculations.
   */
  callDescription?: string;
}
