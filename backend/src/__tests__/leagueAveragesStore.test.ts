import {
  getLeagueAveragesForEngine,
  resetLeagueAveragesForTests,
  setLeagueAverages,
} from "../services/leagueAveragesStore";

describe("leagueAveragesStore", () => {
  beforeEach(() => {
    resetLeagueAveragesForTests();
  });

  it("returns engine overrides for the current season", () => {
    setLeagueAverages({
      season: 2026,
      chaseRate: 0.291,
      walkRate: 0.088,
      strikeoutRate: 0.221,
      whiffRate: 0.246,
      ops: 0.735,
      woba: 0.318,
      computedAt: "2026-07-09T00:00:00.000Z",
    });

    expect(getLeagueAveragesForEngine()).toEqual({
      chaseRate: 0.291,
      walkRate: 0.088,
      strikeoutRate: 0.221,
      whiffRate: 0.246,
      ops: 0.735,
      woba: 0.318,
    });
  });

  it("returns undefined for a mismatched season", () => {
    setLeagueAverages({
      season: 2025,
      chaseRate: 0.3,
      walkRate: 0.085,
      strikeoutRate: 0.225,
      whiffRate: 0.25,
      ops: 0.728,
      woba: 0.315,
      computedAt: "2026-07-09T00:00:00.000Z",
    });

    expect(getLeagueAveragesForEngine()).toBeUndefined();
  });
});
