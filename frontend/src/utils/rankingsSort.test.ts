import { describe, expect, it } from "vitest";
import type { PlayerRankingRow, TeamRankingRow } from "../api/types";
import {
  coerceSortForSide,
  defaultOrderForSort,
  nextSortState,
  sortPlayerRows,
  sortTeamRows,
} from "./rankingsSort";

function player(overrides: Partial<PlayerRankingRow> & Pick<PlayerRankingRow, "playerId">): PlayerRankingRow {
  return {
    rank: 0,
    playerName: `Player ${overrides.playerId}`,
    challengesUsed: 0,
    challengesOverturned: 0,
    overturnRate: null,
    missedOpportunities: 0,
    battingMissedCount: 0,
    battingMissedValue: 0,
    fieldingMissedCount: 0,
    fieldingMissedValue: 0,
    totalMissedValue: 0,
    battingGainedRe: 0,
    fieldingGainedRe: 0,
    totalGainedRe: 0,
    badChallenges: 0,
    gamesAppeared: 1,
    ...overrides,
  };
}

function team(overrides: Partial<TeamRankingRow> & Pick<TeamRankingRow, "teamId">): TeamRankingRow {
  return {
    rank: 0,
    teamAbbrev: "TST",
    teamName: "Test Team",
    challengesUsed: 0,
    challengesOverturned: 0,
    overturnRate: null,
    battingMissedCount: 0,
    battingMissedValue: 0,
    fieldingMissedCount: 0,
    fieldingMissedValue: 0,
    totalMissedValue: 0,
    battingGainedRe: 0,
    fieldingGainedRe: 0,
    totalGainedRe: 0,
    badChallenges: 0,
    gamesAppeared: 1,
    ...overrides,
  };
}

describe("nextSortState", () => {
  it("selects a new column with its default order", () => {
    expect(nextSortState("missedRe", "desc", "name")).toEqual({
      sort: "name",
      order: "asc",
    });
    expect(nextSortState("name", "asc", "fieldingGainedRe")).toEqual({
      sort: "fieldingGainedRe",
      order: "desc",
    });
  });

  it("flips order when the same column is clicked again", () => {
    expect(nextSortState("missedRe", "desc", "missedRe")).toEqual({
      sort: "missedRe",
      order: "asc",
    });
    expect(nextSortState("name", "asc", "name")).toEqual({
      sort: "name",
      order: "desc",
    });
  });
});

describe("defaultOrderForSort", () => {
  it("defaults name to ascending and metrics to descending", () => {
    expect(defaultOrderForSort("name")).toBe("asc");
    expect(defaultOrderForSort("missedRe")).toBe("desc");
  });
});

describe("coerceSortForSide", () => {
  it("leaves sorts unchanged for all", () => {
    expect(coerceSortForSide("missedRe", "all")).toBe("missedRe");
    expect(coerceSortForSide("fieldingGainedRe", "all")).toBe("fieldingGainedRe");
  });

  it("maps total and opposite-side RE onto the active side", () => {
    expect(coerceSortForSide("missedRe", "batting")).toBe("battingMissedRe");
    expect(coerceSortForSide("fieldingMissedRe", "batting")).toBe("battingMissedRe");
    expect(coerceSortForSide("gainedRe", "fielding")).toBe("fieldingGainedRe");
    expect(coerceSortForSide("battingGainedRe", "fielding")).toBe("fieldingGainedRe");
  });
});

describe("sortPlayerRows", () => {
  it("sorts by missed RE descending and re-ranks", () => {
    const rows = [
      player({ playerId: 1, totalMissedValue: 1, playerName: "A" }),
      player({ playerId: 2, totalMissedValue: 3, playerName: "B" }),
      player({ playerId: 3, totalMissedValue: 2, playerName: "C" }),
    ];
    const sorted = sortPlayerRows(rows, "missedRe", "desc");
    expect(sorted.map((r) => r.playerId)).toEqual([2, 3, 1]);
    expect(sorted.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("sorts alphabetically by player name", () => {
    const rows = [
      player({ playerId: 1, playerName: "Charlie" }),
      player({ playerId: 2, playerName: "Alice" }),
      player({ playerId: 3, playerName: "Bob" }),
    ];
    const sorted = sortPlayerRows(rows, "name", "asc");
    expect(sorted.map((r) => r.playerName)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts by fielding gained RE", () => {
    const rows = [
      player({ playerId: 1, fieldingGainedRe: 0.1 }),
      player({ playerId: 2, fieldingGainedRe: 0.4 }),
      player({ playerId: 3, fieldingGainedRe: 0.2 }),
    ];
    const sorted = sortPlayerRows(rows, "fieldingGainedRe", "desc");
    expect(sorted.map((r) => r.playerId)).toEqual([2, 3, 1]);
  });

  it("sorts null overturn rates last when descending", () => {
    const rows = [
      player({ playerId: 1, overturnRate: 0.5 }),
      player({ playerId: 2, overturnRate: null }),
      player({ playerId: 3, overturnRate: 0.8 }),
    ];
    const sorted = sortPlayerRows(rows, "challengeSuccess", "desc");
    expect(sorted.map((r) => r.playerId)).toEqual([3, 1, 2]);
  });

  it("sorts misses by batting count when side is batting", () => {
    const rows = [
      player({ playerId: 1, battingMissedCount: 1, fieldingMissedCount: 9, missedOpportunities: 10 }),
      player({ playerId: 2, battingMissedCount: 4, fieldingMissedCount: 0, missedOpportunities: 4 }),
    ];
    const sorted = sortPlayerRows(rows, "misses", "desc", "batting");
    expect(sorted.map((r) => r.playerId)).toEqual([2, 1]);
  });

  it("coerces total missed sort to fielding when side is fielding", () => {
    const rows = [
      player({ playerId: 1, totalMissedValue: 9, fieldingMissedValue: 0.1 }),
      player({ playerId: 2, totalMissedValue: 1, fieldingMissedValue: 0.8 }),
    ];
    const sorted = sortPlayerRows(rows, "missedRe", "desc", "fielding");
    expect(sorted.map((r) => r.playerId)).toEqual([2, 1]);
  });
});

describe("sortTeamRows", () => {
  it("sorts by total missed RE ascending", () => {
    const rows = [
      team({ teamId: 1, teamAbbrev: "AAA", totalMissedValue: 5 }),
      team({ teamId: 2, teamAbbrev: "BBB", totalMissedValue: 1 }),
    ];
    const sorted = sortTeamRows(rows, "missedRe", "asc");
    expect(sorted.map((r) => r.teamId)).toEqual([2, 1]);
  });

  it("sorts by batting missed RE when that column is selected", () => {
    const rows = [
      team({ teamId: 1, battingMissedValue: 0.1, fieldingMissedValue: 9 }),
      team({ teamId: 2, battingMissedValue: 0.5, fieldingMissedValue: 0 }),
    ];
    const sorted = sortTeamRows(rows, "battingMissedRe", "desc");
    expect(sorted.map((r) => r.teamId)).toEqual([2, 1]);
  });

  it("breaks ties by gained RE then abbrev", () => {
    const rows = [
      team({ teamId: 1, teamAbbrev: "ZZZ", totalMissedValue: 1, totalGainedRe: 0 }),
      team({ teamId: 2, teamAbbrev: "AAA", totalMissedValue: 1, totalGainedRe: 0 }),
    ];
    const sorted = sortTeamRows(rows, "missedRe", "desc");
    expect(sorted.map((r) => r.teamAbbrev)).toEqual(["AAA", "ZZZ"]);
  });
});
