import { LeagueAverages } from "../domain/leagueContext.types";
import { PlayerCredibilityResult } from "../features/playerCredibility";
import { OffensiveValueResult } from "../features/offensiveValue";
import { DefensiveContextResult } from "../features/defensiveContext";
import { BaserunningContextResult } from "../features/baserunningContext";
import { LineupContextResult } from "../features/lineupContext";
import { SituationWeightResult } from "../features/situationWeight";
import { ChallengeScarcityResult } from "../features/challengeScarcity";
import { ThresholdResult } from "./thresholds";

/** Intermediate state produced by each pipeline stage in decideChallenge. */
export interface PipelineContext {
  league: LeagueAverages;
  reDelta: number;
  credibility: PlayerCredibilityResult;
  baserunning: BaserunningContextResult;
  offensiveValue: OffensiveValueResult;
  lineupContext: LineupContextResult;
  defensiveContext: DefensiveContextResult;
  rawEV: number;
  situation: SituationWeightResult;
  adjustedEV: number;
  score: number;
  scarcity: ChallengeScarcityResult;
  thresholdResult: ThresholdResult;
}
