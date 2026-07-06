export type RankingsPeriod = "week" | "season";

export interface PlayerRankingRow {
  rank: number;
  playerId: number;
  playerName: string;
  challengesUsed: number;
  challengesOverturned: number;
  overturnRate: number | null;
  missedOpportunities: number;
  totalMissedValue: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
  totalGainedRe: number;
  badChallenges: number;
  gamesAppeared: number;
}

export interface TeamRankingRow {
  rank: number;
  teamId: number;
  teamAbbrev: string;
  teamName: string;
  challengesUsed: number;
  challengesOverturned: number;
  overturnRate: number | null;
  battingMissedCount: number;
  battingMissedValue: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
  totalGainedRe: number;
  badChallenges: number;
  gamesAppeared: number;
}

export type RankingsLeaderboardSort = "missedRe" | "gainedRe" | "challengeSuccess";
export type RankingsSortOrder = "asc" | "desc";

export interface RankingsResponse {
  period: RankingsPeriod;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  trackingStartDate: string;
  windowDays: number;
  sort: RankingsLeaderboardSort;
  order: RankingsSortOrder;
  gameCount: number;
  rows: PlayerRankingRow[] | TeamRankingRow[];
}

export type PlayerRankingsResponse = RankingsResponse & { rows: PlayerRankingRow[] };
export type TeamRankingsResponse = RankingsResponse & { rows: TeamRankingRow[] };

export interface RankingsBundleResponse extends RankingsResponse {
  players: PlayerRankingRow[];
  teams: TeamRankingRow[];
}
