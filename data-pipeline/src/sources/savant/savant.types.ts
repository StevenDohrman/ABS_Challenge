/**
 * Savant source types.
 *
 * All types carry a `raw` field with the original CSV row for debuggability
 * and forward-compatibility when Savant adds or renames columns.
 *
 * Numeric fields are null when absent or unparseable — callers must handle
 * nulls rather than assuming Savant always populates every metric.
 */

// ---------------------------------------------------------------------------
// Postgame pitch-level data (statcast_search CSV)
// Used in Phase 5 for missed-challenge audits.
// ---------------------------------------------------------------------------

export interface SavantPitchRow {
  gamePk: number;
  gameDate: string;

  atBatNumber: number;
  pitchNumber: number;

  batterId: number;
  pitcherId: number;

  plateX: number | null;
  plateZ: number | null;
  szTop: number | null;
  szBot: number | null;

  description: string;
  zone: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Pregame / daily data — fetched once per day before games start
// ---------------------------------------------------------------------------

/**
 * Per-batter aggregated Statcast metrics for a season.
 *
 * Populated from:
 *   expected_statistics leaderboard → xba, xslg, xwoba, barrel_batted_rate,
 *                                     hard_hit_percent, k_percent, bb_percent
 *   custom leaderboard (oz_swing_percent, whiff_percent selections) →
 *                                     chasePercent, whiffPercent, zonePercent
 *
 * Fields not available from a given fetch are null.
 */
export interface SavantBatterStatline {
  playerId: number;
  playerName: string;
  season: number;

  pa: number;

  /** Traditional stats from Savant's perspective. */
  ba: number | null;
  slg: number | null;
  woba: number | null;
  kPercent: number | null;
  bbPercent: number | null;

  /** Expected / model-derived metrics. */
  xba: number | null;
  xslg: number | null;
  xwoba: number | null;

  /** Contact quality. */
  hardHitPercent: number | null;
  barrelPercent: number | null;
  avgExitVelocity: number | null;
  avgLaunchAngle: number | null;
  sweetSpotPercent: number | null;

  /**
   * Plate discipline.
   * chasePercent: swings at pitches outside the zone (oz_swing_percent).
   * whiffPercent: whiffs per swing.
   * zonePercent: percentage of pitches seen in the strike zone.
   * A disciplined batter with a low chasePercent is more credible when
   * they claim a pitch was outside the zone.
   */
  chasePercent: number | null;
  whiffPercent: number | null;
  zonePercent: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}

/**
 * Batter batted-ball spray profile for a season.
 * Captures directional tendencies (pull/straight/oppo) and trajectory mix
 * (GB/FB/LD). Used to evaluate defensive positioning value when assessing
 * whether a challenged call would have resulted in an out anyway.
 */
export interface SavantBatterSprayProfile {
  playerId: number;
  playerName: string;
  season: number;

  pa: number;

  /** Directional tendencies (0–100). */
  pullPercent: number | null;
  straightawayPercent: number | null;
  oppoPercent: number | null;

  /** Batted-ball type mix (0–100). */
  gbPercent: number | null;
  fbPercent: number | null;
  ldPercent: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}

/**
 * Fielder Outs Above Average for a season and position.
 * OAA measures how many outs a fielder converts above or below expectation
 * given the difficulty of batted balls hit to their zone.
 *
 * Used in the challenge engine to estimate whether a would-be hit was
 * actually catchable, which affects the expected-value calculation.
 */
export interface SavantFielderOaa {
  playerId: number;
  playerName: string;
  season: number;

  /** Fielding position abbreviation: "1B", "2B", "3B", "SS", "LF", "CF", "RF". */
  position: string;

  oaa: number | null;

  /** OAA split by batter handedness — useful for spray-aware positioning. */
  oaaVsRhh: number | null;
  oaaVsLhh: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}

/**
 * Per-player sprint speed (feet per second) from Statcast.
 * Applies to both offensive and defensive players.
 *
 * Used in the engine to estimate:
 *  - Baserunner advancement after a successful challenge (batter becomes runner).
 *  - Outfielder range contribution on top of OAA.
 */
export interface SavantSprintSpeed {
  playerId: number;
  playerName: string;
  season: number;
  position: string;

  /** Top sprint speed in ft/s. MLB average ≈ 27 ft/s. */
  sprintSpeed: number | null;

  /** Home-to-first time in seconds (timed plays only). */
  homeTo1b: number | null;

  /** Number of competitive runs used to calculate the sprint speed. */
  competitiveRuns: number;

  raw: Record<string, string>;
  fetchedAt: string;
}

/**
 * Individual pitch from Statcast for a specific batter or pitcher.
 * Fetched per-player at lineup confirmation time (not daily bulk).
 *
 * For batters: reveals zone tendencies, borderline pitch frequency, and
 * discipline metrics in context (which counts, vs which handedness).
 *
 * For pitchers: reveals edge-working tendencies and typical pitch location
 * distributions — useful for estimating how often their pitches land near
 * the zone boundary.
 */
/**
 * Per-pitcher pitch-type mix for a season.
 * Ingested daily from Savant pitch arsenal stats + Statcast ball/strike rates.
 */
export interface SavantPitcherPitchMix {
  pitcherId: number;
  pitcherName: string;
  season: number;

  /** Savant pitch type code, e.g. "FF", "SL". */
  pitchType: string;
  /** Human-readable name from Savant, e.g. "4-Seam Fastball". */
  pitchTypeName: string;

  /** Share of pitcher's arsenal (0–1). */
  usageRate: number;
  /** Fraction of pitches called balls (0–1). Null when Statcast sample missing. */
  ballRate: number | null;
  /** Fraction of pitches called strikes, excluding in-play (0–1). Optional. */
  strikeRate: number | null;

  pitchCount: number;

  raw: Record<string, string>;
  fetchedAt: string;
}

export interface SavantPlayerPitchHistory {
  gamePk: number;
  gameDate: string;
  season: number;

  batterId: number;
  pitcherId: number;

  atBatNumber: number;
  pitchNumber: number;

  pitchType: string | null;
  releaseSpeed: number | null;

  balls: number;
  strikes: number;
  outsWhenUp: number;
  inning: number;

  /** Batter stance: L or R. */
  stand: "L" | "R" | null;
  /** Pitcher throwing hand: L or R. */
  pThrows: "L" | "R" | null;

  /** Pitch result category: B = ball, S = strike, X = in play. */
  type: "B" | "S" | "X" | null;

  /** Full description: "called_strike", "ball", "swinging_strike", etc. */
  description: string;

  /** At-bat result for the terminal pitch; null for non-terminal pitches. */
  events: string | null;

  plateX: number | null;
  plateZ: number | null;
  szTop: number | null;
  szBot: number | null;

  /** Savant strike zone region 1–9 (in-zone) or 11–14 (shadow/out-of-zone). */
  zone: number | null;

  /** wOBA numerator/denominator on terminal pitches (Statcast search CSV). */
  wobaValue: number | null;
  wobaDenom: number | null;
  /** estimated_woba_using_speedangle on in-play pitches. */
  estimatedWoba: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}
