/**
 * The state of the game at the moment of a challenge decision.
 *
 * When the backend pre-computes all 12 count states at the start of each
 * at-bat, it builds one GameStateContext per count — so `balls` and `strikes`
 * represent the count BEFORE the pitch was thrown, not the count after.
 */
export interface GameStateContext {
  gamePk: number;

  inning: number;
  halfInning: "top" | "bottom";

  /**
   * Ball count BEFORE this pitch. Range: 0–3.
   * The challenge decision is made before the outcome of the pitch is recorded.
   */
  balls: number;

  /**
   * Strike count BEFORE this pitch. Range: 0–2.
   * The challenge decision is made before the outcome of the pitch is recorded.
   */
  strikes: number;

  outs: number;

  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;

  homeScore: number;
  awayScore: number;

  /**
   * Positive when the batting team is winning, negative when trailing.
   * Example: batting team up by 2 → +2. Down by 3 → -3.
   */
  runDifferentialForBattingTeam: number;

  battingTeamId: number;
  fieldingTeamId: number;

  batterId: number;
  pitcherId: number;

  /**
   * How many challenges the batting team has available right now.
   *
   * Under ABS rules this is the regulation allotment minus failed challenges
   * (a successful challenge is retained); in extra innings it is the flat
   * per-inning grant. Used only to tune scarcity — it does NOT gate the
   * recommendation. A value of 0 still yields a value-based recommendation so
   * missed opportunities are auditable.
   */
  challengesRemaining: number;
}
