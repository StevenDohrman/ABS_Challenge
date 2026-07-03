/**
 * Engine constants, organized by domain.
 *
 * Every numeric threshold, weight, and limit used across the engine lives here
 * so that the reasoning behind each value is documented in one place and can
 * be tuned without hunting across files.
 *
 * Sections:
 *   BASEBALL_RULES    — immutable facts of the game (do not tune)
 *   LEAGUE_AVERAGES   — MLB averages used for normalization (update each season)
 *   CREDIBILITY       — P(call was wrong) estimation parameters
 *   SITUATION         — game-situation leverage parameters
 *   SCARCITY          — challenge resource-cost parameters
 *   SCORING           — EV → 0–100 score normalization parameters
 *   THRESHOLDS        — score → recommendation label and confidence parameters
 */

// ---------------------------------------------------------------------------
// Baseball rules — facts of the game, never tunable
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// League averages — used to normalize batter discipline metrics
// Update at the start of each season with current MLB averages.
// Source: Baseball Savant leaderboards (2024 MLB season baseline).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Credibility — parameters for P(call was wrong) estimation
// ---------------------------------------------------------------------------

export const CREDIBILITY = {
  /**
   * Baseline probability that a challenged called strike was actually a ball,
   * before any player-specific adjustments are applied.
   * Represents an "unknown batter" challenging a borderline pitch.
   */
  BASE_P_CALL_WRONG: 0.32,

  /** Floor — even the most aggressive batter retains a minimal chance of being right. */
  MIN_P_CALL_WRONG: 0.15,

  /** Ceiling — even the most disciplined batter can't exceed this given ABS accuracy. */
  MAX_P_CALL_WRONG: 0.55,

  // ── Plate discipline weights ──────────────────────────────────────────────
  // Three signals contribute to the discipline score. Weights express their
  // relative importance and must conceptually sum to 1.0 when all are present.

  // ── Discipline signal weights ─────────────────────────────────────────────
  // Relative importance of each plate discipline metric. Must sum to 1.0.
  // The total is used as the normalization denominator so that missing metrics
  // reduce influence rather than inflating the remaining signals.

  /** Chase rate (oz_swing_percent) — primary signal; directly measures zone recognition. */
  CHASE_WEIGHT: 0.50,

  /** Walk rate — supporting signal; a patient batter demonstrates zone recognition over time. */
  WALK_WEIGHT: 0.20,

  /** Strikeout rate — penalty signal; frequent Ks indicate vulnerability to borderline pitches. */
  STRIKEOUT_WEIGHT: 0.15,

  /**
   * Whiff rate — secondary discipline signal; high whiff rate indicates
   * difficulty reading pitch movement near the zone edge.
   */
  WHIFF_WEIGHT: 0.15,

  // ── Scale factors ─────────────────────────────────────────────────────────
  // Each weight is multiplied by a scale factor that controls how much a
  // one-unit deviation from league average shifts the discipline score.
  // Together, weight × scale determines a signal's maximum possible contribution.

  /** How much each unit of chase rate deviation shifts the score. */
  CHASE_SCALE: 0.40,

  /** How much each unit of walk rate deviation shifts the score. */
  WALK_SCALE: 0.90,

  /** How much each unit of strikeout rate deviation shifts the score. */
  STRIKEOUT_SCALE: 0.50,

  /** How much each unit of whiff rate deviation shifts the score. */
  WHIFF_SCALE: 0.40,

  /**
   * Maximum absolute value of the aggregate discipline adjustment.
   * Prevents extreme outlier discipline numbers from dominating the estimate.
   */
  MAX_DISCIPLINE_ADJUSTMENT: 0.12,

  // ── Handedness modifiers ──────────────────────────────────────────────────
  // Same-hand matchups (RHP vs RHB) pitch away from the batter's eye line;
  // the edge is harder to read → lower credibility.
  // Opposite-hand matchups pitch across the plate → slightly higher credibility.

  /** Additive delta when pitcher and batter throw/bat from the same side. */
  SAME_HAND_MODIFIER: -0.03,

  /** Additive delta when pitcher and batter are from opposite sides. */
  OPPOSITE_HAND_MODIFIER: 0.03,

  // ── Offensive value multiplier ────────────────────────────────────────────
  // The RE delta from a challenge is worth more when the batter at the plate
  // is an above-average offensive player. A star keeping their at-bat alive
  // generates more expected future run value than a bench player.

  /**
   * Maximum multiplier applied to the RE delta for an elite batter (high OPS).
   * A multiplier of 1.15 means the challenge is worth 15% more for this batter
   * than for a league-average batter.
   */
  OFFENSIVE_VALUE_MAX_MULTIPLIER: 1.15,

  /**
   * Minimum multiplier for a well-below-average batter (low OPS).
   * Floors at 0.85 so a poor batter's challenge is still partially valued.
   */
  OFFENSIVE_VALUE_MIN_MULTIPLIER: 0.85,

  // ── Historical accuracy blend ─────────────────────────────────────────────

  /**
   * Minimum number of historical challenge attempts before history is
   * given any weight. Below this, the sample is too small to be reliable.
   */
  HISTORY_MIN_ATTEMPTS: 5,

  /**
   * Number of historical attempts at which the historical success rate
   * receives full weight (1.0) in the blend. Below this, weight scales
   * linearly from 0 (at HISTORY_MIN_ATTEMPTS) to 1.0 (here).
   */
  HISTORY_FULL_WEIGHT_ATTEMPTS: 20,
} as const;

// ---------------------------------------------------------------------------
// Situation — game-state leverage parameters
// ---------------------------------------------------------------------------

export const SITUATION = {
  // ── Inning leverage ramp ──────────────────────────────────────────────────
  // Leverage increases linearly from inning 1 to inning 9, then stays at max.

  /** Leverage multiplier for inning 1 (earliest possible game state). */
  INNING_LEVERAGE_MIN: 0.60,

  /** Leverage multiplier for inning 9 and beyond. */
  INNING_LEVERAGE_MAX: 1.45,

  // ── Walk-off bonus ────────────────────────────────────────────────────────
  // Applied when the home team is batting in the 9th or later while trailing
  // or tied — any run could end the game.

  /** Added to inning leverage in walk-off territory. */
  WALK_OFF_BONUS: 0.20,

  // ── Late-inning challenge urgency ─────────────────────────────────────────
  // Use-it-or-lose-it: with challenges left in the final inning(s), borderline
  // wrong calls are worth spending a challenge on before the game ends.

  /** Inning at or after which unused challenges incur an urgency multiplier. */
  LATE_INNING_CHALLENGE_URGENCY: 9,

  /** Multiplier bonus when 2+ challenges remain (full allotment). */
  CHALLENGE_URGENCY_BONUS_WITH_TWO: 0.28,

  /** Multiplier bonus when exactly 1 challenge remains. */
  CHALLENGE_URGENCY_BONUS_WITH_ONE: 0.18,

  /**
   * Maximum run deficit for the home team to qualify for the walk-off bonus.
   * At -3, a single challenge success could eventually tie or win the game.
   */
  WALK_OFF_MAX_DEFICIT: -3,

  // ── Game-closeness flags ──────────────────────────────────────────────────

  /** Inning at or after which the game is considered "late". */
  LATE_GAME_INNING: 7,

  /** Maximum absolute run differential to be considered a "close" game. */
  CLOSE_GAME_MAX_RUN_DIFF: 2,

  /** Minimum absolute run differential to be considered a "blowout". */
  BLOWOUT_MIN_RUN_DIFF: 5,

  // ── Run differential leverage ─────────────────────────────────────────────
  // Indexed by absolute run gap (0 = tie, 4 = 4-run lead/deficit).
  // Gap ≥ 5 (blowout) uses RUN_DIFF_LEVERAGE_BLOWOUT.

  /**
   * Leverage multipliers by absolute run gap.
   * Index 0 = tied, index 1 = 1-run game, ..., index 4 = 4-run game.
   */
  RUN_DIFF_LEVERAGE_BY_GAP: [1.00, 0.95, 0.85, 0.72, 0.55] as const,

  /** Leverage multiplier for blowout games (gap ≥ 5 runs). */
  RUN_DIFF_LEVERAGE_BLOWOUT: 0.35,

  // ── Final weight bounds ───────────────────────────────────────────────────

  /** Minimum combined situation weight (floors the leverage in any scenario). */
  WEIGHT_MIN: 0.30,

  /** Maximum combined situation weight (caps the leverage in peak scenarios). */
  WEIGHT_MAX: 1.90,
} as const;

// ---------------------------------------------------------------------------
// Scarcity — challenge resource-cost parameters
// ---------------------------------------------------------------------------

export const SCARCITY = {
  /**
   * Teams with at least this many challenges are considered to have "plenty"
   * (their full allotment) — no threshold or confidence penalty is applied.
   * Under the current ABS rules a team starts with 2 challenges, so 2 is the
   * full-allotment baseline.
   */
  PLENTY_MIN_CHALLENGES: 2,

  /**
   * Teams with exactly this many challenges are in "moderate" scarcity.
   * With a 2-challenge allotment this tier is currently unreachable (2 counts as
   * plenty); retained for flexibility if the allotment changes.
   */
  MODERATE_CHALLENGES: 2,

  /** Teams with exactly this many challenges are in "scarce" territory. */
  SCARCE_CHALLENGES: 1,

  // ── Moderate scarcity adjustments (2 challenges remaining) ───────────────

  /** Points added to every recommendation score threshold when moderately scarce. */
  MODERATE_THRESHOLD_SHIFT: 8,

  /** Points added to minimum confidence required when moderately scarce. */
  MODERATE_CONFIDENCE_SHIFT: 5,

  // ── Scarce adjustments (1 challenge remaining) ────────────────────────────

  /** Points added to every recommendation score threshold when scarce. */
  SCARCE_THRESHOLD_SHIFT: 14,

  /** Points added to minimum confidence required when scarce. */
  SCARCE_CONFIDENCE_SHIFT: 15,
} as const;

// ---------------------------------------------------------------------------
// Scoring — EV → 0–100 score normalization
// ---------------------------------------------------------------------------

export const SCORING = {
  /**
   * The situation-adjusted EV (in runs) that maps to a score of exactly 50.
   * Represents the minimum useful EV given that challenges are finite resources.
   * An EV below this produces a score under 50, which combined with scarcity
   * threshold shifts can push the result into DENY territory.
   */
  BREAK_EVEN_EV: 0.025,

  /**
   * The additional EV above BREAK_EVEN_EV needed to reach a score of 100.
   * An EV of (BREAK_EVEN_EV + SCALE_EV) = 0.245 maps to score 100.
   */
  SCALE_EV: 0.22,

  /** The score value representing exactly break-even EV. Center of the scale. */
  MIDPOINT: 50,
} as const;

// ---------------------------------------------------------------------------
// Defensive context — spray-based RE-delta multiplier
// ---------------------------------------------------------------------------

/**
 * Spray-based defensive multiplier parameters.
 *
 * V1 uses the batter's batted-ball type mix (GB/FB/LD) to scale the RE delta
 * by a small factor reflecting how the defense is typically positioned against
 * this batter.  The effect is intentionally small (max ±10%) so it does not
 * dominate the situational and credibility signals.
 *
 * Rationale:
 *  - GB-heavy batters tend to produce more infield outs (league-avg GB ≈ 44%).
 *    A batter who is unusually GB-heavy has a lower "hit value" per BIP → the
 *    RE delta of keeping them at bat is slightly lower than league average.
 *  - LD-heavy batters have the highest BABIP (~.680 for line drives) → the
 *    extra at-bat is unusually valuable → small positive multiplier.
 *  - FB batters are intermediate but slightly positive (extra-base potential).
 *
 * When specific fielder OAA data is available (future enhancement), multiply
 * the fielder's spray-zone OAA contribution on top of this spray factor.
 */
export const DEFENSIVE = {
  /** League-average ground ball rate (0–1). Source: MLB 2024 average. */
  LEAGUE_AVG_GB_RATE: 0.44,

  /** League-average fly ball rate (0–1). */
  LEAGUE_AVG_FB_RATE: 0.33,

  /** League-average line drive rate (0–1). */
  LEAGUE_AVG_LD_RATE: 0.23,

  /**
   * Multiplier scale per unit of GB-rate deviation from league average.
   * Positive GB deviation (batter more GB-heavy than average) lowers the
   * multiplier (ground balls produce more outs).  Each 0.10 deviation shifts
   * the multiplier by 0.10 × GB_SCALE = 2.0%.
   */
  GB_SCALE: 0.20,

  /**
   * Multiplier scale per unit of FB-rate deviation.
   * Positive FB deviation (more fly balls) slightly boosts the multiplier.
   */
  FB_SCALE: 0.15,

  /**
   * Multiplier scale per unit of LD-rate deviation.
   * LD has the highest BABIP (~.680) of any batted-ball type, so deviations
   * here have the largest per-unit impact on expected hit value.
   */
  LD_SCALE: 0.35,

  /** Maximum defensive multiplier (spray-favourable hitter). */
  MAX_MULTIPLIER: 1.10,

  /** Minimum defensive multiplier (strongly GB-heavy hitter). */
  MIN_MULTIPLIER: 0.90,

  /**
   * Multiplier scale per unit of fielder OAA.
   * A fielder with +15 OAA converts ~6% more batted balls into outs than average.
   * Each OAA unit shifts the multiplier by ±0.4%:
   *   +15 OAA → -6% multiplier (elite defender → less value in extending at-bat)
   *   -15 OAA → +6% multiplier (poor defender → more value in extending at-bat)
   * The OAA component stacks with the spray component; both are clamped together.
   */
  OAA_SCALE: 0.004,
} as const;

// ---------------------------------------------------------------------------
// Baserunning — sprint speed RE-delta multiplier (walk paths only)
// ---------------------------------------------------------------------------

export const BASERUNNING = {
  /** MLB average top sprint speed in ft/s (Statcast). */
  LEAGUE_AVG_SPRINT_SPEED: 27,

  /** Multiplier shift per ft/s above/below league average. */
  SPEED_SCALE: 0.007,

  MIN_MULTIPLIER: 0.90,
  MAX_MULTIPLIER: 1.10,

  /** Relative weights for forced advances on a walk. */
  WEIGHT_BATTER_TO_FIRST: 1.0,
  WEIGHT_R1_TO_SECOND: 1.5,
  WEIGHT_R2_TO_THIRD: 2.0,
  WEIGHT_R3_SCORES: 4.0,
} as const;

// ---------------------------------------------------------------------------
// Lineup — upcoming batters window multiplier
// ---------------------------------------------------------------------------

export const LINEUP = {
  /** windowSize = WINDOW_BASE - outs */
  WINDOW_BASE: 5,

  /** Decay weights for on-deck, next, etc. */
  SLOT_DECAY: [1.0, 0.85, 0.70, 0.55, 0.45] as const,

  LEAGUE_AVG_WOBA: 0.320,

  /** Each 0.050 wOBA above/below average shifts multiplier by ~0.05. */
  WOBA_SCALE: 1.0,

  MIN_MULTIPLIER: 0.90,
  MAX_MULTIPLIER: 1.10,
} as const;

// ---------------------------------------------------------------------------
// Thresholds — score → recommendation label and minimum confidence
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  // ── Base recommendation label boundaries (before scarcity shift) ──────────

  /** Score at or above which the engine recommends AUTO_ALLOW. */
  AUTO_ALLOW: 75,

  /** Score at or above which the engine recommends ALLOW (below AUTO_ALLOW). */
  ALLOW: 50,

  /** Score at or above which the engine recommends WARN (below ALLOW). */
  WARN: 28,

  // ── Minimum confidence required — ALLOW zone ─────────────────────────────
  // Confidence interpolates linearly from ENTRY (at the ALLOW/WARN boundary)
  // down to EXIT (at the ALLOW/AUTO_ALLOW boundary).

  /** Minimum confidence required when the score just enters the ALLOW zone. */
  ALLOW_CONFIDENCE_ENTRY: 60,

  /** Minimum confidence required when the score is at the top of the ALLOW zone. */
  ALLOW_CONFIDENCE_EXIT: 25,

  // ── Minimum confidence required — WARN zone ───────────────────────────────
  // Confidence interpolates from ENTRY (at the WARN/DENY boundary) down to
  // EXIT (at the WARN/ALLOW boundary).

  /** Minimum confidence required when the score just enters the WARN zone. */
  WARN_CONFIDENCE_ENTRY: 85,

  /** Minimum confidence required when the score is at the top of the WARN zone. */
  WARN_CONFIDENCE_EXIT: 65,
} as const;
