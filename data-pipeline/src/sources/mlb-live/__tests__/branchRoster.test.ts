import { buildLiveFeedResponse } from "./fixtures/mlbLiveFeed.fixture";
import {
  assessBranchRosterFromFeed,
  parseGameBullpen,
  parsePlayerNamesFromFeed,
  parseDefenseFromBoxscore,
  parseGameBench,
  isWarmupOrGameActive,
} from "../branchRoster";

describe("isWarmupOrGameActive", () => {
  it("detects warmup", () => {
    expect(isWarmupOrGameActive("Warmup")).toBe(true);
    expect(isWarmupOrGameActive("Pre-Game")).toBe(true);
  });
});

describe("assessBranchRosterFromFeed", () => {
  it("eligible when both teams have batting orders", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [], currentPlay: undefined },
        linescore: buildLiveFeedResponse().liveData.linescore,
        boxscore: {
          teams: {
            home: { team: { id: 133 }, battingOrder: [1, 2, 3], batters: [1, 2, 3, 4], bullpen: [99] },
            away: { team: { id: 134 }, battingOrder: [5, 6, 7], batters: [5, 6, 7, 8], pitchers: [88, 89] },
          },
        },
      },
    });
    const result = assessBranchRosterFromFeed(feed);
    expect(result.eligible).toBe(true);
    expect(result.roster.home.lineup).toBe(3);
  });

  it("eligible during warmup with roster pool but no full lineup", () => {
    const feed = buildLiveFeedResponse({
      gameData: {
        ...buildLiveFeedResponse().gameData,
        status: { ...buildLiveFeedResponse().gameData.status, detailedState: "Warmup" },
      },
      liveData: {
        plays: { allPlays: [], currentPlay: undefined },
        linescore: buildLiveFeedResponse().liveData.linescore,
        boxscore: {
          teams: {
            home: { team: { id: 133 }, batters: [1, 2], bullpen: [99] },
            away: { team: { id: 134 }, batters: [5, 6], pitchers: [88, 89] },
          },
        },
      },
    });
    const result = assessBranchRosterFromFeed(feed);
    expect(result.eligible).toBe(true);
    expect(result.lineupIncomplete).toBe(true);
    expect(result.reason).toContain("warmup");
  });

  it("not eligible before warmup without boxscore", () => {
    const feed = buildLiveFeedResponse({
      gameData: {
        ...buildLiveFeedResponse().gameData,
        status: {
          abstractGameState: "Preview",
          detailedState: "Scheduled",
          abstractGameCode: "P",
          statusCode: "S",
        },
      },
      liveData: {
        ...buildLiveFeedResponse().liveData,
        boxscore: undefined,
      },
    });
    const result = assessBranchRosterFromFeed(feed);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("warmup");
  });
});

describe("parseGameBullpen", () => {
  it("uses explicit bullpen array", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        ...buildLiveFeedResponse().liveData,
        boxscore: {
          teams: {
            home: { team: { id: 133 }, bullpen: [100, 101] },
            away: { team: { id: 134 }, bullpen: [200] },
          },
        },
      },
    });
    expect(parseGameBullpen(feed).home).toEqual([100, 101]);
  });
});

describe("parsePlayerNamesFromFeed", () => {
  it("extracts names from gameData.players", () => {
    const feed = buildLiveFeedResponse();
    const names = parsePlayerNamesFromFeed(feed);
    expect(names[682998]).toBe("Jacob Wilson");
  });
});

describe("parseGameBench", () => {
  it("prefers explicit MLB bench array", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        ...buildLiveFeedResponse().liveData,
        boxscore: {
          teams: {
            home: {
              team: { id: 133 },
              battingOrder: [1, 2, 3, 4, 5, 6, 7, 8, 9],
              batters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
              bench: [50, 51, 52],
              bullpen: [99, 100],
            },
            away: { team: { id: 134 }, battingOrder: [] },
          },
        },
      },
    });
    expect(parseGameBench(feed).home).toEqual([50, 51, 52]);
  });

  it("excludes pitchers and bullpen arms from bench", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        ...buildLiveFeedResponse().liveData,
        boxscore: {
          teams: {
            home: {
              team: { id: 133 },
              battingOrder: [1, 2, 3],
              batters: [1, 2, 3, 10, 11, 99],
              pitchers: [99, 100],
              bullpen: [100],
              players: {
                ID99: { person: { id: 99 }, position: { abbreviation: "P" } },
                ID10: { person: { id: 10 }, position: { abbreviation: "LF" } },
              },
            },
            away: { team: { id: 134 }, battingOrder: [] },
          },
        },
      },
    });
    expect(parseGameBench(feed).home).toEqual([10, 11]);
  });
});

describe("parseDefenseFromBoxscore", () => {
  it("maps batting-order positions to defensive slots", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        ...buildLiveFeedResponse().liveData,
        boxscore: {
          teams: {
            home: {
              team: { id: 133 },
              battingOrder: [10, 11, 12],
              pitchers: [99],
              players: {
                ID10: { person: { id: 10 }, position: { abbreviation: "CF" } },
                ID11: { person: { id: 11 }, position: { abbreviation: "SS" } },
                ID12: { person: { id: 12 }, position: { abbreviation: "C" } },
              },
            },
            away: { team: { id: 134 }, battingOrder: [] },
          },
        },
      },
    });
    const defense = parseDefenseFromBoxscore(feed, "home");
    expect(defense.center).toBe(10);
    expect(defense.shortstop).toBe(11);
    expect(defense.catcher).toBe(12);
    expect(defense.pitcher).toBe(99);
  });
});
