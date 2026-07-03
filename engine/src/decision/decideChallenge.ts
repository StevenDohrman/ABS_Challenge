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
 *  1. Hard gate
 *     Short-circuit to DENY only when the call type itself is not a challengeable
 *     called strike — the expected value of challenging is structurally undefined
 *     there. Being out of challenges is NOT a gate: the engine still produces a
 *     value-based recommendation so the system can audit missed opportunities.
 *     Whether the team can physically challenge is tracked separately by the
 *     backend (challengeAvailable on the persisted recommendation).
 *
 *  2. Run expectancy (pre-computed by caller)
 *     The backend calls computeChallengeOutcomeExpectancies() before decideChallenge:
 *       current, ifSucceeds, ifFails  — expected runs for rest of inning
 *     reDelta = runExpectancyIfSuccessful - runExpectancyIfFailed
 *     See data/runExpectancy.ts.
 *
 *  3. Baserunning multiplier (walk paths only)
 *     Scales reDelta on 3-ball counts using sprint speed and lead-runner bottleneck
 *     logic on forced advances. Non-walk success paths → 1.0×.
 *     See features/baserunningContext.ts.
 *
 *  4. Player credibility  →  P(call was wrong)
 *     Estimated from plate discipline, matchup handedness, count context, and
 *     historical challenge accuracy. See features/playerCredibility.ts.
 *
 *  5. Offensive value multiplier
 *     Scales the RE delta by how valuable this batter is relative to league
 *     average (OPS). Null OPS → 1.0×. See features/offensiveValue.ts.
 *
 *  6. Lineup context multiplier
 *     Scales reDelta by decay-weighted quality of upcoming batters in the due-up
 *     window (5 - outs, excluding current batter). See features/lineupContext.ts.
 *
 *  7. Defensive context multiplier
 *     Small ±10% correction from batter spray profile and fielder OAA.
 *     See features/defensiveContext.ts.
 *
 *  8. Raw expected value
 *     rawEV = P(call was wrong) × reDelta
 *           × baserunningMultiplier × offensiveMultiplier
 *           × lineupMultiplier × defensiveMultiplier
 *
 *  9. Situation weight  →  leverage multiplier
 *     adjustedEV = rawEV × situationWeight
 *     Late innings, close games, and extra innings amplify raw EV; blowouts dampen.
 *     See features/situationWeight.ts.
 *
 * 10. Score normalization  (0–100)
 *     score = normalize(adjustedEV)
 *     See decision/scoring.ts.
 *
 * 11. Scarcity + thresholds
 *     Recommendation label and minimum confidence from score, with threshold
 *     shifts when challenges are scarce. See features/challengeScarcity.ts,
 *     decision/thresholds.ts.
 *
 * 12. Explanation
 *     Human-readable sentences for the key factors. See decision/explanation.ts.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ChallengeDecisionInput,
  ChallengeDecision,
} from "../domain/challengeDecision.types";
import { computePlayerCredibility } from "../features/playerCredibility";
import { computeOffensiveValue } from "../features/offensiveValue";
import { computeDefensiveContext } from "../features/defensiveContext";
import { computeBaserunningContext } from "../features/baserunningContext";
import { computeLineupContext } from "../features/lineupContext";
import { computeSituationWeight } from "../features/situationWeight";
import { computeChallengeScarcity } from "../features/challengeScarcity";
import { normalizeScore } from "./scoring";
import { applyThresholds } from "./thresholds";
import { buildExplanation } from "./explanation";
import { resolveLeagueAverages } from "../utils/leagueAverages";
import { validateChallengeDecisionInput } from "../validation/validateInput";
import { PipelineContext } from "./pipeline.types";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function decideChallenge(input: ChallengeDecisionInput): ChallengeDecision {
  if (input.pitchContext.callType !== "called_strike") {
    return hardDeny(
      `Call type "${input.pitchContext.callType}" is not a challengeable called strike.`
    );
  }

  validateChallengeDecisionInput(input);

  const pipeline = runPipeline(input);

  const explanation = buildExplanation({
    recommendation: pipeline.thresholdResult.recommendation,
    score: pipeline.score,
    reDelta: pipeline.reDelta,
    adjustedEV: pipeline.adjustedEV,
    credibility: pipeline.credibility,
    baserunning: pipeline.baserunning,
    lineupContext: pipeline.lineupContext,
    situation: pipeline.situation,
    scarcity: pipeline.scarcity,
    thresholdResult: pipeline.thresholdResult,
    balls: input.gameState.balls,
    strikes: input.gameState.strikes,
    inning: input.gameState.inning,
    halfInning: input.gameState.halfInning,
  });

  return {
    recommendation: pipeline.thresholdResult.recommendation,
    score: pipeline.score,
    expectedValueOfChallenge: pipeline.adjustedEV,
    minimumPlayerConfidenceRequired:
      pipeline.thresholdResult.minimumPlayerConfidenceRequired,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

function runPipeline(input: ChallengeDecisionInput): PipelineContext {
  const league = resolveLeagueAverages(input.leagueAverages);

  const reDelta =
    input.runExpectancyIfSuccessful - input.runExpectancyIfFailed;

  const baserunning = computeBaserunningContext(
    input.gameState,
    input.baserunningContext
  );

  const credibility = computePlayerCredibility(
    input.playerContext,
    input.pitchContext,
    input.gameState,
    league
  );

  const offensiveValue = computeOffensiveValue(input.playerContext, league);

  const lineupContext = computeLineupContext(input.lineupContext, league);

  const defensiveContext = computeDefensiveContext(input.playerContext);

  const rawEV =
    credibility.pCallWasWrong *
    reDelta *
    baserunning.multiplier *
    offensiveValue.multiplier *
    lineupContext.multiplier *
    defensiveContext.multiplier;

  const situation = computeSituationWeight(input.gameState);
  const adjustedEV = rawEV * situation.weight;
  const score = normalizeScore(adjustedEV);

  const scarcity = computeChallengeScarcity(input.gameState.challengesRemaining);
  const thresholdResult = applyThresholds(score, scarcity);

  return {
    league,
    reDelta,
    credibility,
    baserunning,
    offensiveValue,
    lineupContext,
    defensiveContext,
    rawEV,
    situation,
    adjustedEV,
    score,
    scarcity,
    thresholdResult,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hardDeny(reason: string): ChallengeDecision {
  return {
    recommendation: "DENY",
    score: 0,
    expectedValueOfChallenge: 0,
    minimumPlayerConfidenceRequired: 100,
    explanation: [reason],
  };
}
