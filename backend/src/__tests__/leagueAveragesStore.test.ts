import {
  getLeagueAveragesForEngine,
  getLeagueSprayDefaultsPercent,
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
      gbRate: 0.45,
      fbRate: 0.32,
      ldRate: 0.23,
      pullRate: 0.4,
      straightawayRate: 0.35,
      oppoRate: 0.25,
      sprintSpeed: 27.5,
      computedAt: "2026-07-09T00:00:00.000Z",
    });

    expect(getLeagueAveragesForEngine()).toEqual({
      chaseRate: 0.291,
      walkRate: 0.088,
      strikeoutRate: 0.221,
      whiffRate: 0.246,
      ops: 0.735,
      woba: 0.318,
      gbRate: 0.45,
      fbRate: 0.32,
      ldRate: 0.23,
      pullRate: 0.4,
      straightawayRate: 0.35,
      oppoRate: 0.25,
      sprintSpeed: 27.5,
    });
  });

  it("exposes spray defaults on the 0–100 scale for OAA zone weights", () => {
    setLeagueAverages({
      season: 2026,
      chaseRate: 0.3,
      walkRate: 0.085,
      strikeoutRate: 0.225,
      whiffRate: 0.25,
      ops: 0.728,
      woba: 0.315,
      gbRate: 0.44,
      fbRate: 0.33,
      ldRate: 0.23,
      pullRate: 0.39,
      straightawayRate: 0.34,
      oppoRate: 0.27,
      sprintSpeed: 27,
      computedAt: "2026-07-09T00:00:00.000Z",
    });

    expect(getLeagueSprayDefaultsPercent()).toEqual({
      pull: 39,
      straight: 34,
      oppo: 27,
      gb: 44,
      fb: 56,
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
      gbRate: 0.44,
      fbRate: 0.33,
      ldRate: 0.23,
      pullRate: 0.39,
      straightawayRate: 0.34,
      oppoRate: 0.27,
      sprintSpeed: 27,
      computedAt: "2026-07-09T00:00:00.000Z",
    });

    expect(getLeagueAveragesForEngine()).toBeUndefined();
    expect(getLeagueSprayDefaultsPercent()).toBeNull();
  });
});
