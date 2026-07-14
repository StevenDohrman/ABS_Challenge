/**
 * Player Credibility
 *
 * Estimates the probability that the call was wrong — i.e., that a challenge
 * would succeed — based entirely on information available in real time (no pitch
 * location data).
 *
 * This is not a hard probability; it is a calibrated prior that reflects how
 * trustworthy a given batter's challenge instinct is, given their demonstrated
 * ability to identify the strike zone. It is then combined with the run
 * expectancy delta inside the engine to produce expected value.
 *
 * Three groups of signals contribute:
 *
 *   1. Plate discipline (primary)
 *      Chase rate, walk rate, strikeout rate, and whiff rate each contribute
 *      a signed delta. Signals are weighted; missing signals contribute zero
 *      and do NOT inflate the remaining signals (see normalization note below).
 *
 *   2. Matchup handedness (modifier)
 *      Same-hand matchups (RHP vs RHB) pitch away from the batter's eye line;
 *      opposite-hand matchups pitch across the plate where the batter can track
 *      the ball into the zone more clearly.
 *
 *   3. Historical challenge accuracy (blended when sample is large enough)
 *      If the batter has challenged ≥ HISTORY_MIN_ATTEMPTS times, their actual
 *      success rate is blended in with increasing weight up to
 *      HISTORY_FULL_WEIGHT_ATTEMPTS.
 *
 * Count context modifier (applied after all the above):
 *      In a 3-0 count pitchers groove pitches; in an 0-2 count they work the
 *      corners. This shifts P(call wrong) slightly based on the expected pitch
 *      location distribution for that count.
 *
 * ── Normalization note ────────────────────────────────────────────────────
 * The discipline score divides by the TOTAL possible weight of all four
 * signals (not just the weight of signals that were present). This means:
 *
 *   - A batter with all four signals available → full range of ±MAX_DISCIPLINE_ADJUSTMENT
 *   - A batter with only one signal available → proportionally smaller adjustment
 *   - A batter with no signals at all → discipline score = 0 (falls back to BASE_P_CALL_WRONG)
 *
 * Missing data reduces influence on the estimate. It does NOT cause the
 * available signals to be re-scaled upward to compensate.
 */

import { PlayerChallengeContext } from "../domain/playerContext.types";
import { PitchCallContext } from "../domain/pitchContext.types";
import { GameStateContext } from "../domain/gameContext.types";
import { LeagueAverages } from "../domain/leagueContext.types";
import { Balls, Strikes } from "../domain/baseball.types";
import { CREDIBILITY } from "../constants";
import { clamp } from "../utils/clamp";

// ---------------------------------------------------------------------------
// Total weight denominator — sum of all four signal weights (must equal 1.0)
// ---------------------------------------------------------------------------

const TOTAL_DISCIPLINE_WEIGHT =
  CREDIBILITY.CHASE_WEIGHT +
  CREDIBILITY.WALK_WEIGHT +
  CREDIBILITY.STRIKEOUT_WEIGHT +
  CREDIBILITY.WHIFF_WEIGHT;

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface PlayerCredibilityResult {
  /** The estimated probability the call was wrong. */
  pCallWasWrong: number;

  /** Breakdown of contributing factors for explanation generation. */
  components: {
    /** Signed delta from plate discipline metrics. Zero when no metrics are available. */
    baselineDisciplineScore: number;
    /** Fraction of discipline signals that were present (0.0–1.0). */
    dataCompleteness: number;
    /** Additive delta from pitcher/batter handedness matchup. */
    handednessModifier: number;
    /** 0–1 weight given to historical challenge success rate in the final blend. */
    historicalBlendWeight: number;
    /** Additive delta from the count context. */
    countModifier: number;
  };
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Estimates P(call was wrong) for a batter challenging a called strike.
 *
 * @param league - Current-season league averages from the backend. Used as the
 *   baseline each batter is measured against. Provided by decideChallenge after
 *   merging caller-supplied values with compile-time constants.
 */
export function computePlayerCredibility(
  player: PlayerChallengeContext,
  pitch: PitchCallContext,
  gameState: GameStateContext,
  league: LeagueAverages
): PlayerCredibilityResult {
  const { score: baselineDisciplineScore, dataCompleteness } =
    computeDisciplineScore(player, league);

  const handednessModifier = computeHandednessModifier(player, pitch);
  const countModifier = computeCountModifier(gameState.balls, gameState.strikes);

  let estimate =
    CREDIBILITY.BASE_P_CALL_WRONG + baselineDisciplineScore + handednessModifier;

  // Blend in historical challenge accuracy when sample size is meaningful
  const historicalBlendWeight = computeHistoricalBlendWeight(player);
  if (historicalBlendWeight > 0 && player.historicalChallengeSuccessRate !== null) {
    estimate =
      estimate * (1 - historicalBlendWeight) +
      player.historicalChallengeSuccessRate * historicalBlendWeight;
  }

  estimate += countModifier;

  return {
    pCallWasWrong: clamp(
      estimate,
      CREDIBILITY.MIN_P_CALL_WRONG,
      CREDIBILITY.MAX_P_CALL_WRONG
    ),
    components: {
      baselineDisciplineScore,
      dataCompleteness,
      handednessModifier,
      historicalBlendWeight,
      countModifier,
    },
  };
}

// ---------------------------------------------------------------------------
// Plate discipline score
// ---------------------------------------------------------------------------

/**
 * Converts plate discipline metrics into a signed delta on top of BASE_P_CALL_WRONG.
 *
 * Each signal contributes: deviation_from_league_avg × weight × scale_factor.
 * The result is divided by TOTAL_DISCIPLINE_WEIGHT (the sum of all signal weights)
 * so that missing signals shrink the discipline adjustment rather than
 * amplifying the remaining signals.
 *
 * Returns:
 *   score            — clamped to [−MAX_DISCIPLINE_ADJUSTMENT, +MAX_DISCIPLINE_ADJUSTMENT]
 *   dataCompleteness — fraction of the four signals that were available (0.0–1.0)
 */
function computeDisciplineScore(
  player: PlayerChallengeContext,
  league: LeagueAverages
): {
  score: number;
  dataCompleteness: number;
} {
  let rawScore = 0;
  let weightPresent = 0;

  if (player.chasePercent !== null) {
    rawScore +=
      (league.chaseRate - player.chasePercent) *
      CREDIBILITY.CHASE_WEIGHT *
      CREDIBILITY.CHASE_SCALE;
    weightPresent += CREDIBILITY.CHASE_WEIGHT;
  }

  if (player.walkRate !== null) {
    rawScore +=
      (player.walkRate - league.walkRate) *
      CREDIBILITY.WALK_WEIGHT *
      CREDIBILITY.WALK_SCALE;
    weightPresent += CREDIBILITY.WALK_WEIGHT;
  }

  if (player.strikeoutRate !== null) {
    rawScore +=
      (league.strikeoutRate - player.strikeoutRate) *
      CREDIBILITY.STRIKEOUT_WEIGHT *
      CREDIBILITY.STRIKEOUT_SCALE;
    weightPresent += CREDIBILITY.STRIKEOUT_WEIGHT;
  }

  if (player.whiffPercent !== null) {
    rawScore +=
      (league.whiffRate - player.whiffPercent) *
      CREDIBILITY.WHIFF_WEIGHT *
      CREDIBILITY.WHIFF_SCALE;
    weightPresent += CREDIBILITY.WHIFF_WEIGHT;
  }

  const dataCompleteness = weightPresent / TOTAL_DISCIPLINE_WEIGHT;

  if (weightPresent === 0) {
    return { score: 0, dataCompleteness: 0 };
  }

  // Divide by TOTAL weight (not just present weight) so missing signals
  // contribute zero instead of inflating the signals that are available.
  const score = clamp(
    rawScore / TOTAL_DISCIPLINE_WEIGHT,
    -CREDIBILITY.MAX_DISCIPLINE_ADJUSTMENT,
    CREDIBILITY.MAX_DISCIPLINE_ADJUSTMENT
  );

  return { score, dataCompleteness };
}

// ---------------------------------------------------------------------------
// Matchup handedness modifier
// ---------------------------------------------------------------------------

/**
 * Adjusts credibility based on pitcher/batter handedness matchup.
 *
 * Same-hand: pitcher throws toward the batter's back side.
 *   The outer edge of the zone is harder to see → SAME_HAND_MODIFIER (negative).
 *
 * Opposite-hand: pitcher throws across the plate into the batter's field of vision.
 *   Edge pitches are more visible → OPPOSITE_HAND_MODIFIER (positive).
 *
 * Switch hitters and unknown handedness return 0 (no adjustment).
 */
function computeHandednessModifier(
  player: PlayerChallengeContext,
  pitch: PitchCallContext
): number {
  if (
    player.battingHand === null ||
    player.battingHand === "S" ||
    pitch.pitcherHandedness === null
  ) {
    return 0;
  }

  const sameHand = player.battingHand === pitch.pitcherHandedness;
  return sameHand
    ? CREDIBILITY.SAME_HAND_MODIFIER
    : CREDIBILITY.OPPOSITE_HAND_MODIFIER;
}

// ---------------------------------------------------------------------------
// Count modifier
// ---------------------------------------------------------------------------

/**
 * Adjusts P(call wrong) based on the count when the pitch was thrown.
 *
 * Pitchers in hitter-friendly counts (2-0, 3-0) aim for the heart of the plate
 * — a called strike is likely correct.
 * Pitchers in pitcher-friendly counts (0-2, 1-2) work the corners and throw
 * borderline pitches — a called strike is more likely to be genuinely close.
 */
function computeCountModifier(balls: Balls, strikes: Strikes): number {
  const key = `${balls}-${strikes}` as keyof typeof CREDIBILITY.COUNT_MODIFIERS;
  return CREDIBILITY.COUNT_MODIFIERS[key] ?? 0;
}

// ---------------------------------------------------------------------------
// Historical accuracy blend
// ---------------------------------------------------------------------------

/**
 * Returns the weight (0–1) to give historical challenge success rate.
 *
 * Weight scales linearly from 0 (at HISTORY_MIN_ATTEMPTS) to 1.0 (at
 * HISTORY_FULL_WEIGHT_ATTEMPTS). Below the minimum, history is ignored
 * because the sample is too noisy to be reliable.
 */
function computeHistoricalBlendWeight(player: PlayerChallengeContext): number {
  if (
    player.historicalChallengeAttempts < CREDIBILITY.HISTORY_MIN_ATTEMPTS ||
    player.historicalChallengeSuccessRate === null
  ) {
    return 0;
  }

  return Math.min(
    1,
    player.historicalChallengeAttempts / CREDIBILITY.HISTORY_FULL_WEIGHT_ATTEMPTS
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
