import { describe, expect, it } from "vitest";
import type { PlayerRankingRow, TeamRankingRow } from "../api/types";
import { sortPlayerRows, sortTeamRows } from "./rankingsSort";

function player(overrides: Partial<PlayerRankingRow> & Pick<PlayerRankingRow, "playerId">): PlayerRankingRow {
  return {
    rank: 0,
    playerName: `Player ${overrides.playerId}`,
    challengesUsed: 0,
    challengesOverturned: 0,
    overturnRate: null,
    missedOpportunities: 0,
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
    battingGainedRe: 0,
    fieldingGainedRe: 0,
    totalGainedRe: 0,
    badChallenges: 0,
    gamesAppeared: 1,
    ...overrides,
  };
}

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

  it("sorts null overturn rates last when descending", () => {
    const rows = [
      player({ playerId: 1, overturnRate: 0.5 }),
      player({ playerId: 2, overturnRate: null }),
      player({ playerId: 3, overturnRate: 0.8 }),
    ];
    const sorted = sortPlayerRows(rows, "challengeSuccess", "desc");
    expect(sorted.map((r) => r.playerId)).toEqual([3, 1, 2]);
  });
});

describe("sortTeamRows", () => {
  it("sorts by batting missed value ascending", () => {
    const rows = [
      team({ teamId: 1, teamAbbrev: "AAA", battingMissedValue: 5 }),
      team({ teamId: 2, teamAbbrev: "BBB", battingMissedValue: 1 }),
    ];
    const sorted = sortTeamRows(rows, "missedRe", "asc");
    expect(sorted.map((r) => r.teamId)).toEqual([2, 1]);
  });

  it("breaks ties by gained RE then abbrev", () => {
    const rows = [
      team({ teamId: 1, teamAbbrev: "ZZZ", battingMissedValue: 1, totalGainedRe: 0 }),
      team({ teamId: 2, teamAbbrev: "AAA", battingMissedValue: 1, totalGainedRe: 0 }),
    ];
    const sorted = sortTeamRows(rows, "missedRe", "desc");
    expect(sorted.map((r) => r.teamAbbrev)).toEqual(["AAA", "ZZZ"]);
  });
});
