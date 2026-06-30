import type {
  PlayerRankingRow,
  RankingsLeaderboardSort,
  RankingsSortOrder,
  TeamRankingRow,
} from "../api/types";

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

export function sortPlayerRows(
  rows: PlayerRankingRow[],
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder
): PlayerRankingRow[] {
  const sorted = [...rows].sort((a, b) => {
    let primary: number;
    if (sort === "challengeSuccess") {
      primary = compareRate(a.overturnRate, b.overturnRate, order);
    } else if (sort === "gainedRe") {
      primary = compareNumeric(a.totalGainedRe, b.totalGainedRe, order);
    } else {
      primary = compareNumeric(a.totalMissedValue, b.totalMissedValue, order);
    }
    if (primary !== 0) return primary;
    return b.totalGainedRe - a.totalGainedRe || a.playerName.localeCompare(b.playerName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function sortTeamRows(
  rows: TeamRankingRow[],
  sort: RankingsLeaderboardSort,
  order: RankingsSortOrder
): TeamRankingRow[] {
  const sorted = [...rows].sort((a, b) => {
    let primary: number;
    if (sort === "challengeSuccess") {
      primary = compareRate(a.overturnRate, b.overturnRate, order);
    } else if (sort === "gainedRe") {
      primary = compareNumeric(a.totalGainedRe, b.totalGainedRe, order);
    } else {
      primary = compareNumeric(a.battingMissedValue, b.battingMissedValue, order);
    }
    if (primary !== 0) return primary;
    return b.totalGainedRe - a.totalGainedRe || a.teamAbbrev.localeCompare(b.teamAbbrev);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}
