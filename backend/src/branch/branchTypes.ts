import type { DefensiveLineup } from "@abs/data-pipeline";
import type {
  AtBatRecommendationGridResponseDto,
  GameAtBatHistoryDto,
  ScheduleGameDto,
} from "../challenge.dto";

export const BRANCH_SCHEMA_VERSION = 1 as const;

export interface BranchCheckpoint {
  atBatIndex?: number;
  label?: string;
}

export interface BranchRunners {
  first?: number;
  second?: number;
  third?: number;
}

export interface BranchSituation {
  inning: number;
  halfInning: "top" | "bottom";
  balls: number;
  strikes: number;
  outs: number;
  runners: BranchRunners;
  homeScore: number;
  awayScore: number;
  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  fieldingTeamId: number;
  homeChallengesRemaining: number;
  awayChallengesRemaining: number;
}

export interface TeamBranchState {
  teamId: number;
  battingOrder: number[];
  bench: number[];
  bullpen: number[];
  defense: DefensiveLineup;
  removedFromGame: number[];
}

export interface BranchForkSnapshot {
  situation: BranchSituation;
  teams: {
    home: TeamBranchState;
    away: TeamBranchState;
  };
  checkpoint: BranchCheckpoint;
  playerNames: Record<number, string>;
}

export interface BranchDocument {
  schemaVersion: typeof BRANCH_SCHEMA_VERSION;
  branchId: string;
  parentGamePk: number;
  forkedAt: string;
  checkpoint: BranchCheckpoint;
  schedule: ScheduleGameDto;
  playerNames: Record<number, string>;
  teams: {
    home: TeamBranchState;
    away: TeamBranchState;
  };
  situation: BranchSituation;
  forkSnapshot: BranchForkSnapshot;
  lineupIncomplete?: boolean;
  atBatHistory?: GameAtBatHistoryDto;
  previewGrid?: AtBatRecommendationGridResponseDto;
  previewGridComputedAt?: string;
}

export interface TeamRosterCountsDto {
  lineup: number;
  bench: number;
  bullpen: number;
  batters: number;
  pitchers: number;
}

export interface BranchEligibilityDto {
  gamePk: number;
  eligible: boolean;
  reason: string;
  lineupIncomplete: boolean;
  warmupStarted: boolean;
  roster: {
    home: TeamRosterCountsDto;
    away: TeamRosterCountsDto;
  };
}

export interface GameLineupsResponseDto {
  gamePk: number;
  lineups: Array<{
    teamId: number;
    playerId: number;
    battingOrder: number;
  }>;
}

export interface GameExportBundleDto {
  gamePk: number;
  exportedAt: string;
  schedule: ScheduleGameDto;
  playerNames: Record<number, string>;
  lineups: GameLineupsResponseDto["lineups"];
  lineupIncomplete: boolean;
  teams: {
    home: Omit<TeamBranchState, "removedFromGame">;
    away: Omit<TeamBranchState, "removedFromGame">;
  };
  situation: BranchSituation;
  checkpoint: BranchCheckpoint;
  atBatHistory?: GameAtBatHistoryDto;
}
