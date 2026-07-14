import {
  parseRankingsSortOptions,
  rankPlayerRows,
  rankTeamRows,
  type PlayerRankingRow,
  type TeamRankingRow,
} from "../services/rankingsService";

describe("rankPlayerRows", () => {
  const rows: PlayerRankingRow[] = [
    {
      rank: 0,
      playerId: 600,
      playerName: "Batter",
      challengesUsed: 0,
      challengesOverturned: 0,
      overturnRate: null,
      missedOpportunities: 1,
      battingMissedCount: 1,
      battingMissedValue: 0.15,
      fieldingMissedCount: 0,
      fieldingMissedValue: 0,
      totalMissedValue: 0.15,
      battingGainedRe: 0.22,
      fieldingGainedRe: 0,
      totalGainedRe: 0.22,
      badChallenges: 0,
      gamesAppeared: 1,
    },
    {
      rank: 0,
      playerId: 500,
      playerName: "Challenger",
      challengesUsed: 1,
      challengesOverturned: 0,
      overturnRate: 0,
      missedOpportunities: 0,
      battingMissedCount: 0,
      battingMissedValue: 0,
      fieldingMissedCount: 0,
      fieldingMissedValue: 0,
      totalMissedValue: 0,
      battingGainedRe: 0,
      fieldingGainedRe: 0,
      totalGainedRe: 0,
      badChallenges: 1,
      gamesAppeared: 1,
    },
  ];

  it("ranks by missed RE descending by default", () => {
    const ranked = rankPlayerRows(rows, { sort: "missedRe", order: "desc" });
    expect(ranked[0]?.playerId).toBe(600);
    expect(ranked[0]?.rank).toBe(1);
  });

  it("ranks by gained RE descending", () => {
    const ranked = rankPlayerRows(rows, { sort: "gainedRe", order: "desc" });
    expect(ranked[0]?.playerId).toBe(600);
  });
});

describe("rankTeamRows", () => {
  const rows: TeamRankingRow[] = [
    {
      rank: 0,
      teamId: 147,
      teamAbbrev: "NYY",
      teamName: "Yankees",
      challengesUsed: 1,
      challengesOverturned: 1,
      overturnRate: 1,
      battingMissedCount: 1,
      battingMissedValue: 0.2,
      fieldingMissedCount: 0,
      fieldingMissedValue: 0,
      totalMissedValue: 0.2,
      battingGainedRe: 0,
      fieldingGainedRe: 0,
      totalGainedRe: 0,
      badChallenges: 0,
      gamesAppeared: 3,
    },
    {
      rank: 0,
      teamId: 111,
      teamAbbrev: "BOS",
      teamName: "Red Sox",
      challengesUsed: 1,
      challengesOverturned: 1,
      overturnRate: 1,
      battingMissedCount: 0,
      battingMissedValue: 0,
      fieldingMissedCount: 0,
      fieldingMissedValue: 0,
      totalMissedValue: 0,
      battingGainedRe: 0.18,
      fieldingGainedRe: 0,
      totalGainedRe: 0.18,
      badChallenges: 0,
      gamesAppeared: 2,
    },
  ];

  it("ranks by batting missed RE", () => {
    const ranked = rankTeamRows(rows, { sort: "missedRe", order: "desc" });
    expect(ranked[0]?.teamId).toBe(147);
  });
});

describe("parseRankingsSortOptions", () => {
  it("defaults to missed RE descending", () => {
    expect(parseRankingsSortOptions(undefined, undefined)).toEqual({
      sort: "missedRe",
      order: "desc",
    });
  });

  it("accepts gained RE alias", () => {
    expect(parseRankingsSortOptions("totalGainedRe", "desc")).toEqual({
      sort: "gainedRe",
      order: "desc",
    });
  });
});
