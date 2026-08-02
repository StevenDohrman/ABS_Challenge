export type RankingsPeriod = "week" | "season";

export interface PlayerRankingRow {
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
  fieldingMissedCount: number;
  fieldingMissedValue: number;
  totalMissedValue: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
  totalGainedRe: number;
  badChallenges: number;
  gamesAppeared: number;
}

/** Client-side column sorts (URL ?sort=). */
export type RankingsLeaderboardSort =
  | "name"
  | "missedRe"
  | "battingMissedRe"
  | "fieldingMissedRe"
  | "gainedRe"
  | "battingGainedRe"
  | "fieldingGainedRe"
  | "misses"
  | "challenges"
  | "challengeSuccess";

/** RE side filter (URL ?side=). Success % stays combined under batting/fielding. */
export type RankingsSide = "all" | "batting" | "fielding";

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

export interface RankingsBundleResponse extends Omit<RankingsResponse, "rows"> {
  players: PlayerRankingRow[];
  teams: TeamRankingRow[];
}
