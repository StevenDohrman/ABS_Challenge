export type RankingsPeriodDto = "week" | "season";

export type RankingsLeaderboardSortDto = "missedRe" | "gainedRe" | "challengeSuccess";
export type RankingsSortOrderDto = "asc" | "desc";

export interface PlayerRankingRowDto {
  rank: number;
  playerId: number;
  playerName: string;
  challengesUsed: number;
  challengesOverturned: number;
  overturnRate: number | null;
  missedOpportunities: number;
  battingMissedCount: number;
  battingMissedValue: number;
  fieldingMissedCount: number;
  fieldingMissedValue: number;
  totalMissedValue: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
  totalGainedRe: number;
  badChallenges: number;
  gamesAppeared: number;
}

export interface TeamRankingRowDto {
  rank: number;
  teamId: number;
  teamAbbrev: string;
  teamName: string;
  challengesUsed: number;
  challengesOverturned: number;
  overturnRate: number | null;
  battingMissedCount: number;
  battingMissedValue: number;
  fieldingMissedCount: number;
  fieldingMissedValue: number;
  totalMissedValue: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
  totalGainedRe: number;
  badChallenges: number;
  gamesAppeared: number;
}

export interface RankingsResponseMetaDto {
  period: RankingsPeriodDto;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  trackingStartDate: string;
  /** Rolling window length (week mode); matches DATA_RETENTION_DAYS. */
  windowDays: number;
  sort: RankingsLeaderboardSortDto;
  order: RankingsSortOrderDto;
  gameCount: number;
}

export interface PlayerRankingsResponseDto extends RankingsResponseMetaDto {
  rows: PlayerRankingRowDto[];
}

export interface TeamRankingsResponseDto extends RankingsResponseMetaDto {
  rows: TeamRankingRowDto[];
}

export interface RankingsBundleResponseDto extends RankingsResponseMetaDto {
  players: PlayerRankingRowDto[];
  teams: TeamRankingRowDto[];
}
