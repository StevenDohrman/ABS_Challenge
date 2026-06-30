export type RankingsLeaderboardSort = "missedRe" | "gainedRe" | "challengeSuccess";
export type RankingsSortOrder = "asc" | "desc";

export interface RankingsSortOptions {
  sort: RankingsLeaderboardSort;
  order: RankingsSortOrder;
}

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

export function nonEmptyName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareNumeric(a: number, b: number, order: RankingsSortOrder): number {
  return order === "desc" ? b - a : a - b;
}

function compareRate(
  a: number | null,
  b: number | null,
  order: RankingsSortOrder
): number {
  const aVal = a ?? (order === "desc" ? -1 : Number.POSITIVE_INFINITY);
  const bVal = b ?? (order === "desc" ? -1 : Number.POSITIVE_INFINITY);
  return order === "desc" ? bVal - aVal : aVal - bVal;
}

function comparePlayerRows(
  a: PlayerRankingRow,
  b: PlayerRankingRow,
  options: RankingsSortOptions
): number {
  let primary: number;
  if (options.sort === "challengeSuccess") {
    primary = compareRate(a.overturnRate, b.overturnRate, options.order);
  } else if (options.sort === "gainedRe") {
    primary = compareNumeric(a.totalGainedRe, b.totalGainedRe, options.order);
  } else {
    primary = compareNumeric(a.totalMissedValue, b.totalMissedValue, options.order);
  }
  if (primary !== 0) return primary;
  return b.totalGainedRe - a.totalGainedRe || a.playerName.localeCompare(b.playerName);
}

function compareTeamRows(
  a: TeamRankingRow,
  b: TeamRankingRow,
  options: RankingsSortOptions
): number {
  let primary: number;
  if (options.sort === "challengeSuccess") {
    primary = compareRate(a.overturnRate, b.overturnRate, options.order);
  } else if (options.sort === "gainedRe") {
    primary = compareNumeric(a.totalGainedRe, b.totalGainedRe, options.order);
  } else {
    primary = compareNumeric(a.battingMissedValue, b.battingMissedValue, options.order);
  }
  if (primary !== 0) return primary;
  return b.totalGainedRe - a.totalGainedRe || a.teamAbbrev.localeCompare(b.teamAbbrev);
}

export function rankPlayerRows(
  rows: PlayerRankingRow[],
  options: RankingsSortOptions
): PlayerRankingRow[] {
  const sorted = [...rows].sort((a, b) => comparePlayerRows(a, b, options));
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function rankTeamRows(
  rows: TeamRankingRow[],
  options: RankingsSortOptions
): TeamRankingRow[] {
  const sorted = [...rows].sort((a, b) => compareTeamRows(a, b, options));
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

const SORT_ALIASES: Record<string, RankingsLeaderboardSort> = {
  missedRe: "missedRe",
  totalMissedValue: "missedRe",
  battingMissedValue: "missedRe",
  gainedRe: "gainedRe",
  totalGainedRe: "gainedRe",
  challengeSuccess: "challengeSuccess",
  overturnRate: "challengeSuccess",
};

export function parseRankingsSortOptions(
  sortParam: unknown,
  orderParam: unknown
): RankingsSortOptions {
  const sortRaw = typeof sortParam === "string" ? sortParam : "missedRe";
  const sort = SORT_ALIASES[sortRaw] ?? "missedRe";
  const order: RankingsSortOrder = orderParam === "asc" ? "asc" : "desc";
  return { sort, order };
}
