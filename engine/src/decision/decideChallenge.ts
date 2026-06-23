/**
 * Challenge Decision Engine
 *
 * Entry point for the recommendation engine. Given a fully-populated
 * ChallengeDecisionInput, produces a ChallengeDecision.
 *
 * The engine is a pure function — no I/O, no state, no side effects.
 * Test it directly by constructing inputs and asserting on outputs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Algorithm summary
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  1. Hard gates
 *     Short-circuit to DENY immediately if the situation rules out any chance
 *     of recommending a challenge (no challenges left, non-challengeable call).
 *
 *  2. Run expectancy delta
 *     reDelta = runExpectancyIfSuccessful - runExpectancyIfFailed
 *     This quantifies how much the challenge is worth IF the call was wrong.
 *     Pre-computed by the caller using computeChallengeOutcomeExpectancies().
 *
 *  3. Player credibility  →  P(call was wrong)
 *     Estimated from plate discipline, matchup handedness, count context, and
 *     historical challenge accuracy. See features/playerCredibility.ts.
 *
 *  4. Offensive value multiplier
 *     Scales the RE delta by how valuable this batter is relative to league
 *     average. A .900 OPS hitter keeping their at-bat alive is worth more than
 *     a .600 OPS hitter doing the same. Null OPS → 1.0× (no adjustment).
 *     See features/offensiveValue.ts.
 *
 *  5. Raw expected value
 *     rawEV = P(call was wrong) × reDelta × offensiveValueMultiplier
 *
 *  6. Situation weight  →  leverage multiplier
 *     adjustedEV = rawEV × situationWeight
 *     Late innings, close games, and extra innings amplify the raw EV.
 *     Blowouts dampen it. See features/situationWeight.ts.
 *
 *  6. Score normalization  (0–100)
 *     score = normalize(adjustedEV)
 *     Converts runs into a dimensionless score centered at 50 (break-even).
 *
 *  7. Threshold application + scarcity
 *     Recommendation label and minimum confidence are derived from the score.
 *     When challenges are scarce (1–2 remaining), thresholds are raised to
 *     encourage conserving challenges. See decision/thresholds.ts.
 *
 *  8. Explanation
 *     A short ordered list of human-readable sentences describing the key
 *     factors that drove the recommendation. See decision/explanation.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ChallengeDecisionInput,
  ChallengeDecision,
} from "../domain/challengeDecision.types";
import { LeagueAverages } from "../domain/leagueContext.types";
import { computePlayerCredibility } from "../features/playerCredibility";
import { computeOffensiveValue } from "../features/offensiveValue";
import { computeSituationWeight } from "../features/situationWeight";
import { computeChallengeScarcity } from "../features/challengeScarcity";
import { normalizeScore } from "./scoring";
import { applyThresholds } from "./thresholds";
import { buildExplanation } from "./explanation";
import { LEAGUE_AVERAGES } from "../constants";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function decideChallenge(input: ChallengeDecisionInput): ChallengeDecision {
  // ── Step 1: Hard gates ──────────────────────────────────────────────────────

  if (input.gameState.challengesRemaining === 0) {
    return hardDeny("No challenges remaining — cannot challenge this call.");
  }

  if (input.pitchContext.callType !== "called_strike") {
    return hardDeny(
      `Call type "${input.pitchContext.callType}" is not a challengeable called strike.`
    );
  }

  // ── Step 1b: Resolve league averages ───────────────────────────────────────
  // Merge caller-supplied values over compile-time constants. Any field the
  // backend omits falls back to the constant — this keeps the engine functional
  // in tests and offline scenarios with no DB connection.

  const league = resolveLeagueAverages(input.leagueAverages);

  // ── Step 2: Run expectancy delta ────────────────────────────────────────────

  const reDelta =
    input.runExpectancyIfSuccessful - input.runExpectancyIfFailed;

  // ── Step 3: Player credibility  →  P(call was wrong) ───────────────────────

  const credibility = computePlayerCredibility(
    input.playerContext,
    input.pitchContext,
    input.gameState,
    league
  );

  // ── Step 4: Offensive value multiplier ─────────────────────────────────────
  // Scale the RE delta by how valuable this specific batter is relative to a
  // league-average batter. Null OPS/OBP → multiplier of 1.0 (no adjustment).

  const offensiveValue = computeOffensiveValue(input.playerContext, league);

  // ── Step 5: Raw expected value ──────────────────────────────────────────────

  const rawEV = credibility.pCallWasWrong * reDelta * offensiveValue.multiplier;

  // ── Step 6: Situation weight ────────────────────────────────────────────────

  const situation = computeSituationWeight(input.gameState);
  const adjustedEV = rawEV * situation.weight;

  // ── Step 7: Score normalization ─────────────────────────────────────────────

  const score = normalizeScore(adjustedEV);

  // ── Step 8: Scarcity + thresholds ──────────────────────────────────────────

  const scarcity = computeChallengeScarcity(input.gameState.challengesRemaining);
  const thresholdResult = applyThresholds(score, scarcity);

  // ── Step 9: Explanation ─────────────────────────────────────────────────────

  const explanation = buildExplanation({
    recommendation: thresholdResult.recommendation,
    score,
    reDelta,
    adjustedEV,
    credibility,
    situation,
    scarcity,
    thresholdResult,
    balls: input.gameState.balls,
    strikes: input.gameState.strikes,
    inning: input.gameState.inning,
    halfInning: input.gameState.halfInning,
  });

  return {
    recommendation: thresholdResult.recommendation,
    score,
    expectedValueOfChallenge: adjustedEV,
    minimumPlayerConfidenceRequired:
      thresholdResult.minimumPlayerConfidenceRequired,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Merges caller-supplied league averages over the compile-time constants.
 * Fields present in `override` take precedence; missing fields fall back to
 * LEAGUE_AVERAGES from constants.ts.
 */
function resolveLeagueAverages(override?: Partial<LeagueAverages>): LeagueAverages {
  return {
    chaseRate:      override?.chaseRate      ?? LEAGUE_AVERAGES.CHASE_RATE,
    walkRate:       override?.walkRate       ?? LEAGUE_AVERAGES.WALK_RATE,
    strikeoutRate:  override?.strikeoutRate  ?? LEAGUE_AVERAGES.STRIKEOUT_RATE,
    whiffRate:      override?.whiffRate      ?? LEAGUE_AVERAGES.WHIFF_RATE,
    ops:            override?.ops            ?? LEAGUE_AVERAGES.OPS,
  };
}

/**
 * Produces a DENY decision for situations that do not require EV computation.
 */
function hardDeny(reason: string): ChallengeDecision {
  return {
    recommendation: "DENY",
    score: 0,
    expectedValueOfChallenge: 0,
    minimumPlayerConfidenceRequired: 100,
    explanation: [reason],
  };
}
