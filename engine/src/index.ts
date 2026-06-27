/**
 * Public API for the @abs/engine package.
 *
 * The only function external packages need to call is decideChallenge().
 * Everything else is exported to support callers building inputs (especially
 * the run expectancy helpers used by the backend orchestrator).
 */

// Main entry point
export { decideChallenge } from "./decision/decideChallenge";

// Domain types — used by backend and tests to build inputs / interpret outputs
export type {
  GameStateContext,
  PlayerChallengeContext,
  PitchCallContext,
  LeagueAverages,
  ChallengeRecommendation,
  ChallengeDecisionInput,
  ChallengeDecision,
} from "./domain/index";

// Run expectancy utilities — used by backend to pre-compute RE values before
// calling decideChallenge()
export {
  lookupBaseRE,
  computeChallengeOutcomeExpectancies,
} from "./data/runExpectancy";

export type {
  Runners,
  ChallengeOutcomeExpectancies,
} from "./data/runExpectancy";

// Constants — exported so backend and tests can reference the same values
// without duplicating thresholds or baseball rules
export {
  BASEBALL_RULES,
  LEAGUE_AVERAGES,
  CREDIBILITY,
  DEFENSIVE,
  SITUATION,
  SCARCITY,
  SCORING,
  THRESHOLDS,
} from "./constants";
