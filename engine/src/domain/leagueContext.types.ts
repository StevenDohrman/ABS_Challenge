/**
 * LeagueAverages
 *
 * Runtime-injectable league average values used as baselines when comparing
 * individual batter metrics. All fields are the same metrics tracked in
 * engine/src/constants.ts under LEAGUE_AVERAGES — but this type is what the
 * backend passes to the engine so the engine always measures batters against
 * the *current* season, not a compile-time snapshot.
 *
 * How it flows:
 *   1. The data pipeline's daily/weekly job fetches current-season Savant and
 *      MLB Stats API data and computes a fresh LeagueAverages object.
 *   2. The backend caches that object (in memory or DB) and includes it in
 *      every ChallengeDecisionInput it constructs.
 *   3. decideChallenge merges the supplied values over the compile-time
 *      constants — so any field the backend omits falls back to the hardcoded
 *      constant without error.
 *
 * Fallback behavior:
 *   If the backend does not supply leagueAverages (or supplies a partial
 *   object), decideChallenge fills in missing fields from LEAGUE_AVERAGES in
 *   constants.ts. The engine will never throw due to a missing field here.
 */
export interface LeagueAverages {
  /**
   * Fraction of pitches outside the zone that the average batter swings at
   * (oz_swing_percent). Source: Baseball Savant custom leaderboard.
   * Range: 0.0–1.0. Typical value: 0.28–0.32.
   */
  chaseRate: number;

  /**
   * Walk rate (BB / PA) for the league average batter.
   * Source: Savant expected_statistics leaderboard (bb%).
   * Range: 0.0–1.0. Typical value: 0.080–0.095.
   */
  walkRate: number;

  /**
   * Strikeout rate (K / PA) for the league average batter.
   * Source: Savant expected_statistics leaderboard (k%).
   * Range: 0.0–1.0. Typical value: 0.210–0.235.
   */
  strikeoutRate: number;

  /**
   * Whiff rate (swings and misses / total swings) for the league average batter.
   * Source: Savant custom leaderboard (whiff_percent).
   * Range: 0.0–1.0. Typical value: 0.23–0.27.
   */
  whiffRate: number;

  /**
   * League OPS (OBP + SLG) for the average MLB batter in the current season.
   * Source: MLB Stats API /v1/stats, regular-season league aggregate.
   * Typical value: 0.710–0.750.
   */
  ops: number;

  /**
   * League wOBA for the average MLB batter. Used for lineup context multiplier.
   * Falls back to LINEUP.LEAGUE_AVG_WOBA when omitted by the backend.
   */
  woba: number;
}
