/**
 * Everything the engine needs to know about the batter when evaluating a challenge.
 *
 * This is a pre-digested view built by the backend from Savant daily data and
 * MLB Stats API player info. The engine never receives raw API responses.
 *
 * Fields fall into three groups:
 *   1. Offensive value  — how much this at-bat is worth keeping alive
 *   2. Plate discipline — how reliably the batter identifies the strike zone
 *   3. Challenge history — track record of challenge accuracy
 */
export interface PlayerChallengeContext {
  playerId: number;

  /**
   * Batter's stance. Affects which side of the zone is "away" from the batter,
   * which in turn influences how likely they are to correctly identify a pitch
   * as inside vs. outside.
   */
  battingHand: "L" | "R" | "S" | null;

  // ── Offensive value ────────────────────────────────────────────────────────
  // These fields scale how much the run expectancy delta is worth for this
  // specific batter. Keeping a .900 OPS hitter at the plate is worth more
  // than keeping a .600 OPS hitter at the plate, even in the same base/out
  // state, because the higher-value batter is more likely to turn the extra
  // plate appearance into a run.
  //
  // The engine applies a small multiplier (clamped near 1.0) to the RE delta
  // based on OPS deviation from league average. Null → no adjustment (1.0×).

  /**
   * On-base percentage. Null when unavailable (e.g. pitchers hitting, very
   * small sample sizes). Used as a secondary check when OPS is null.
   */
  obp: number | null;

  /**
   * OPS (OBP + SLG). Primary offensive value signal used to scale the RE
   * delta. A batter significantly above league average (≈ .728) receives a
   * small positive multiplier; significantly below receives a small penalty.
   */
  ops: number | null;

  // ── Plate discipline (primary credibility signals) ─────────────────────────

  /**
   * Walk rate (BB / PA). A patient batter who consistently draws walks is
   * demonstrably good at identifying balls — their challenge instinct is credible.
   * Range: 0.0 – 1.0. League average ≈ 0.085.
   */
  walkRate: number | null;

  /**
   * Strikeout rate (K / PA). A batter who strikes out frequently is more
   * susceptible to being fooled on borderline pitches, reducing the credibility
   * of their challenge judgment.
   * Range: 0.0 – 1.0. League average ≈ 0.225.
   */
  strikeoutRate: number | null;

  /**
   * Chase rate (swings on pitches outside the zone / pitches outside the zone).
   * The single strongest credibility signal: a batter who rarely chases
   * demonstrably knows where the zone is. Source: Savant oz_swing_percent.
   * Range: 0.0 – 1.0. League average ≈ 0.30. Elite discipline ≈ 0.20.
   */
  chasePercent: number | null;

  /**
   * Whiff rate (swings and misses / swings). Tracks how often the batter is
   * completely fooled when they do swing. High whiff rate suggests overall
   * difficulty reading pitch movement near the zone.
   * Range: 0.0 – 1.0. League average ≈ 0.25.
   */
  whiffPercent: number | null;

  // ── Challenge history ──────────────────────────────────────────────────────

  /**
   * Number of challenges this batter has attempted historically.
   * Used as the sample size weight when interpreting historicalChallengeSuccessRate.
   * Zero means no historical data — fall back to discipline metrics only.
   */
  historicalChallengeAttempts: number;

  /**
   * Fraction of past challenges that succeeded (call was overturned).
   * Null when historicalChallengeAttempts is 0.
   * A batter who has challenged 10+ times at a high success rate is
   * demonstrably calibrated; weight this heavily.
   */
  historicalChallengeSuccessRate: number | null;

  // ── Defensive context ──────────────────────────────────────────────────────

  /**
   * Batter's batted-ball spray tendencies for the current season (0–1 rates).
   * Used by the defensive feature to compute a small RE-delta multiplier based
   * on the batter's typical hit distribution.
   *
   * V1: populated from player_spray_profiles; no per-fielder OAA adjustment
   * yet (live lineup fielder IDs are not wired). When null, the defensive
   * multiplier defaults to 1.0× (no adjustment).
   */
  sprayProfile: {
    /**
     * Pull/straightaway/oppo rates are backend metadata for future spray-zone
     * features. V1 defensive logic uses only GB/FB/LD below.
     */
    pullPercent: number | null;
    straightawayPercent: number | null;
    oppoPercent: number | null;
    /** Fraction of batted balls that are ground balls (0–1). */
    gbPercent: number | null;
    /** Fraction of batted balls that are fly balls (0–1). */
    fbPercent: number | null;
    /** Fraction of batted balls that are line drives (0–1). */
    ldPercent: number | null;
  } | null;

  /**
   * Outs Above Average for the fielder covering the batter's primary spray
   * zone this at-bat. Positive OAA = elite defender → slightly lower value of
   * extending the at-bat.  Negative OAA = poor defender → slightly higher value.
   *
   * Split by batter handedness (oaaVsRhh / oaaVsLhh) when available.
   * Null when the fielder is unknown (e.g. historical backfill at-bats where
   * the live lineup is unavailable) → 0× adjustment, same as pre-defensive-feature.
   */
  fielderOaa: number | null;
}
