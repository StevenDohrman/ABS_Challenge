import type {
  PlayerRankingRow,
  RankingsLeaderboardSort,
  RankingsSide,
  RankingsSortOrder,
  TeamRankingRow,
} from "../api/types";

const SORT_KEYS: RankingsLeaderboardSort[] = [
  "name",
  "missedRe",
  "battingMissedRe",
  "fieldingMissedRe",
  "gainedRe",
  "battingGainedRe",
  "fieldingGainedRe",
  "misses",
  "challenges",
  "challengeSuccess",
];

const SIDE_KEYS: RankingsSide[] = ["all", "batting", "fielding"];

export function isRankingsSortKey(value: string | null): value is RankingsLeaderboardSort {
  return value != null && (SORT_KEYS as string[]).includes(value);
}

export function isRankingsSide(value: string | null): value is RankingsSide {
  return value != null && (SIDE_KEYS as string[]).includes(value);
}

/**
 * When filtering to batting/fielding, map total or opposite-side RE sorts
 * onto the visible side column so the active sort still matches the UI.
 */
export function coerceSortForSide(
  sort: RankingsLeaderboardSort,
  side: RankingsSide
): RankingsLeaderboardSort {
  if (side === "all") return sort;
  if (side === "batting") {
    if (sort === "missedRe" || sort === "fieldingMissedRe") return "battingMissedRe";
    if (sort === "gainedRe" || sort === "fieldingGainedRe") return "battingGainedRe";
    return sort;
  }
  if (sort === "missedRe" || sort === "battingMissedRe") return "fieldingMissedRe";
  if (sort === "gainedRe" || sort === "battingGainedRe") return "fieldingGainedRe";
  return sort;
}

/** Names default A→Z; numeric / rate columns default high→low. */
export function defaultOrderForSort(sort: RankingsLeaderboardSort): RankingsSortOrder {
  return sort === "name" ? "asc" : "desc";
}

/** First click selects column (with default order); same column again flips order. */
export function nextSortState(
  currentSort: RankingsLeaderboardSort,
  currentOrder: RankingsSortOrder,
  nextSort: RankingsLeaderboardSort
): { sort: RankingsLeaderboardSort; order: RankingsSortOrder } {
  if (currentSort === nextSort) {
    return { sort: nextSort, order: currentOrder === "desc" ? "asc" : "desc" };
  }
  return { sort: nextSort, order: defaultOrderForSort(nextSort) };
}

function compareNumeric(a: number, b: number, order: RankingsSortOrder): number {
  return order === "desc" ? b - a : a - b;
}

/** Null rates (no challenges) always sort last. */
function compareRate(
  a: number | null,
  b: number | null,
  order: RankingsSortOrder
): number {
  const aVal = a ?? (order === "desc" ? -1 : Number.POSITIVE_INFINITY);
  const bVal = b ?? (order === "desc" ? -1 : Number.POSITIVE_INFINITY);
  return order === "desc" ? bVal - aVal : aVal - bVal;
}

function compareText(a: string, b: string, order: RankingsSortOrder): number {
  const cmp = a.localeCompare(b);
  return order === "desc" ? -cmp : cmp;
}

function playerMissCount(row: PlayerRankingRow, side: RankingsSide): number {
  if (side === "batting") return row.battingMissedCount;
  if (side === "fielding") return row.fieldingMissedCount;
  return row.missedOpportunities;
}

function teamMissCount(row: TeamRankingRow, side: RankingsSide): number {
  if (side === "batting") return row.battingMissedCount;
  if (side === "fielding") return row.fieldingMissedCount;
  return row.battingMissedCount + row.fieldingMissedCount;
}

function playerPrimary(
  a: PlayerRankingRow,
  b: PlayerRankingRow,
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder,
  side: RankingsSide
): number {
  switch (sort) {
    case "name":
      return compareText(a.playerName, b.playerName, order);
    case "battingMissedRe":
      return compareNumeric(a.battingMissedValue, b.battingMissedValue, order);
    case "fieldingMissedRe":
      return compareNumeric(a.fieldingMissedValue, b.fieldingMissedValue, order);
    case "gainedRe":
      return compareNumeric(a.totalGainedRe, b.totalGainedRe, order);
    case "battingGainedRe":
      return compareNumeric(a.battingGainedRe, b.battingGainedRe, order);
    case "fieldingGainedRe":
      return compareNumeric(a.fieldingGainedRe, b.fieldingGainedRe, order);
    case "misses":
      return compareNumeric(playerMissCount(a, side), playerMissCount(b, side), order);
    case "challenges":
      return compareNumeric(a.challengesUsed, b.challengesUsed, order);
    case "challengeSuccess":
      return compareRate(a.overturnRate, b.overturnRate, order);
    case "missedRe":
    default:
      return compareNumeric(a.totalMissedValue, b.totalMissedValue, order);
  }
}

function teamPrimary(
  a: TeamRankingRow,
  b: TeamRankingRow,
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder,
  side: RankingsSide
): number {
  switch (sort) {
    case "name":
      return compareText(a.teamAbbrev, b.teamAbbrev, order);
    case "battingMissedRe":
      return compareNumeric(a.battingMissedValue, b.battingMissedValue, order);
    case "fieldingMissedRe":
      return compareNumeric(a.fieldingMissedValue, b.fieldingMissedValue, order);
    case "gainedRe":
      return compareNumeric(a.totalGainedRe, b.totalGainedRe, order);
    case "battingGainedRe":
      return compareNumeric(a.battingGainedRe, b.battingGainedRe, order);
    case "fieldingGainedRe":
      return compareNumeric(a.fieldingGainedRe, b.fieldingGainedRe, order);
    case "misses":
      return compareNumeric(teamMissCount(a, side), teamMissCount(b, side), order);
    case "challenges":
      return compareNumeric(a.challengesUsed, b.challengesUsed, order);
    case "challengeSuccess":
      return compareRate(a.overturnRate, b.overturnRate, order);
    case "missedRe":
    default:
      return compareNumeric(a.totalMissedValue, b.totalMissedValue, order);
  }
}

export function sortPlayerRows(
  rows: PlayerRankingRow[],
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder,
  side: RankingsSide = "all"
): PlayerRankingRow[] {
  const effectiveSort = coerceSortForSide(sort, side);
  const sorted = [...rows].sort((a, b) => {
    const primary = playerPrimary(a, b, effectiveSort, order, side);
    if (primary !== 0) return primary;
    return b.totalGainedRe - a.totalGainedRe || a.playerName.localeCompare(b.playerName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function sortTeamRows(
  rows: TeamRankingRow[],
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder,
  side: RankingsSide = "all"
): TeamRankingRow[] {
  const effectiveSort = coerceSortForSide(sort, side);
  const sorted = [...rows].sort((a, b) => {
    const primary = teamPrimary(a, b, effectiveSort, order, side);
    if (primary !== 0) return primary;
    return b.totalGainedRe - a.totalGainedRe || a.teamAbbrev.localeCompare(b.teamAbbrev);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}
