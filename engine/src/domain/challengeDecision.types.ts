import { GameStateContext } from "./gameContext.types";
import { PlayerChallengeContext } from "./playerContext.types";
import { PitchCallContext } from "./pitchContext.types";
import { LeagueAverages } from "./leagueContext.types";
import { BaserunningContextInput } from "./baserunningContext.types";
import { LineupContextInput } from "./lineupContext.types";

export type ChallengeRecommendation = "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

/**
 * Everything the engine needs to produce a challenge recommendation.
 *
 * The three run expectancy values are pre-computed by the caller (backend)
 * using computeChallengeOutcomeExpectancies() from the runExpectancy module.
 * Separating this step from the engine keeps the engine a pure function that
 * is easy to test with arbitrary RE scenarios.
 */
export interface ChallengeDecisionInput {
  gameState: GameStateContext;
  playerContext: PlayerChallengeContext;
  pitchContext: PitchCallContext;

  /**
   * Current-season league averages used as baselines for batter comparisons.
   *
   * Computed by the data pipeline's weekly league-average job and supplied by
   * the backend. Overrides the compile-time constants in constants.ts field by
   * field — any field not provided falls back to the constant automatically.
   *
   * Omit entirely (or pass undefined) to use compile-time constants only.
   * This keeps the engine fully functional in tests and offline scenarios.
   */
  leagueAverages?: Partial<LeagueAverages>;

  /**
   * Expected runs for the rest of the inning at the current count and base/out state.
   * This is the "do nothing, accept the call" baseline.
   *
   * Validated against computeChallengeOutcomeExpectancies() at decideChallenge entry
   * to catch caller inconsistencies before scoring.
   */
  currentRunExpectancy: number;

  /**
   * Expected runs if the challenge succeeds (call is overturned).
   * For a called-strike challenge: the count advances to (balls+1, strikes)
   * or the batter draws a walk if balls was 3.
   */
  runExpectancyIfSuccessful: number;

  /**
   * Expected runs if the challenge fails (call stands).
   * For a called-strike challenge: the count advances to (balls, strikes+1)
   * or the batter strikes out if strikes was 2.
   */
  runExpectancyIfFailed: number;

  /**
   * Sprint speed context for base-path adjustment on walk-producing counts.
   * Omit when unavailable — engine defaults to 1.0×.
   */
  baserunningContext?: BaserunningContextInput;

  /**
   * Upcoming batters in the due-up window (excludes current batter).
   * Omit when lineup unavailable — engine defaults to 1.0×.
   */
  lineupContext?: LineupContextInput;
}

/**
 * The engine's output for a single challenge decision.
 *
 * recommendation — primary decision label:
 *   AUTO_ALLOW  High EV; recommend challenging regardless of player confidence.
 *   ALLOW       Positive EV; recommend if the player feels confident.
 *   WARN        Marginal or negative EV; caution, do not challenge lightly.
 *   DENY        Insufficient EV; not worth a challenge.
 *
 * The label is purely value-based: it does not consider whether the team has
 * challenges left. Availability is tracked separately by the backend so that a
 * high-value call a team cannot challenge still surfaces as a missed opportunity.
 *
 * minimumPlayerConfidenceRequired — 0-100 threshold the player must meet.
 *   At AUTO_ALLOW this is 0 (challenge without asking).
 *   At DENY this is 100 (no confidence level justifies the cost).
 *
 * expectedValueOfChallenge — the situation-adjusted EV in runs.
 *   Positive = net benefit to batting team if the call is wrong.
 *   Negative = net cost even if the call is wrong (scenario is not worth it).
 *
 * score — 0-100 composite score that drives the recommendation label.
 *   50 = break-even (EV near zero). 80+ = strong case. 20- = clear no.
 *
 * explanation — ordered list of human-readable sentences describing
 *   the key factors that drove this recommendation.
 */
export interface ChallengeDecision {
  recommendation: ChallengeRecommendation;
  minimumPlayerConfidenceRequired: number;
  expectedValueOfChallenge: number;
  score: number;
  explanation: string[];
}
