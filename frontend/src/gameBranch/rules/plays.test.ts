import { describe, it, expect } from "vitest";
import { BRANCH_SCHEMA_VERSION, type BranchDocument } from "../state/branchTypes";
import { applyPlay, availablePlays, playIsAvailable } from "./plays";

const doc = {
  schemaVersion: BRANCH_SCHEMA_VERSION,
  branchId: "test-id",
  parentGamePk: 1,
  forkedAt: "2026-01-01T00:00:00Z",
  checkpoint: {},
  schedule: {
    gamePk: 1,
    homeTeamId: 10,
    awayTeamId: 20,
    homeTeamName: "Home",
    awayTeamName: "Away",
    homeTeamAbbrev: "HOM",
    awayTeamAbbrev: "AWY",
  },
  playerNames: {},
  teams: {
    home: {
      teamId: 10,
      battingOrder: [101, 104],
      bench: [102],
      bullpen: [103],
      defense: { pitcher: 103 },
      removedFromGame: [],
    },
    away: {
      teamId: 20,
      battingOrder: [201, 204],
      bench: [],
      bullpen: [202],
      defense: { pitcher: 202 },
      removedFromGame: [],
    },
  },
  situation: {
    inning: 1,
    halfInning: "top" as const,
    balls: 2,
    strikes: 1,
    outs: 0,
    runners: {},
    homeScore: 0,
    awayScore: 0,
    batterId: 201,
    pitcherId: 103,
    battingTeamId: 20,
    fieldingTeamId: 10,
    homeChallengesRemaining: 2,
    awayChallengesRemaining: 2,
  },
  forkSnapshot: {
    situation: {} as never,
    teams: {} as never,
    checkpoint: {},
    playerNames: {},
  },
} as unknown as BranchDocument;

const sit = doc.situation;

describe("playIsAvailable", () => {
  it("offers sac fly only with a runner on third and fewer than 2 outs", () => {
    expect(playIsAvailable({ ...sit, runners: {}, outs: 0 }, "sac_fly")).toBe(false);
    expect(playIsAvailable({ ...sit, runners: { third: 300 }, outs: 2 }, "sac_fly")).toBe(false);
    expect(playIsAvailable({ ...sit, runners: { third: 300 }, outs: 1 }, "sac_fly")).toBe(true);
  });

  it("offers double play only with a runner and fewer than 2 outs", () => {
    expect(playIsAvailable({ ...sit, runners: {}, outs: 0 }, "double_play")).toBe(false);
    expect(playIsAvailable({ ...sit, runners: { first: 300 }, outs: 2 }, "double_play")).toBe(false);
    expect(playIsAvailable({ ...sit, runners: { second: 300 }, outs: 1 }, "double_play")).toBe(true);
  });

  it("always includes the core plate-appearance actions", () => {
    const plays = availablePlays({ ...sit, runners: {}, outs: 2 });
    expect(plays).toEqual(["walk", "single", "double", "home_run", "strikeout", "out"]);
  });
});

describe("applyPlay hits and walk", () => {
  it("clears the count after a walk and forces only occupied trailing bases", () => {
    const result = applyPlay(doc, { ...sit, runners: { first: 300 }, balls: 3, strikes: 2 }, "walk");
    expect(result.situation.runners).toEqual({ first: 201, second: 300 });
    expect(result.situation.batterId).toBe(204);
    expect(result.situation.balls).toBe(0);
    expect(result.situation.strikes).toBe(0);
  });

  it("does not advance an unforced runner on second on a walk", () => {
    const result = applyPlay(doc, { ...sit, runners: { second: 300 } }, "walk");
    expect(result.situation.runners).toEqual({ first: 201, second: 300 });
    expect(result.situation.awayScore).toBe(0);
  });

  it("scores the runner from third on a bases-loaded walk", () => {
    const result = applyPlay(
      doc,
      { ...sit, runners: { first: 301, second: 302, third: 303 } },
      "walk"
    );
    expect(result.situation.runners).toEqual({ first: 201, second: 301, third: 302 });
    expect(result.situation.awayScore).toBe(1);
    expect(result.description).toContain("run scores");
  });

  it("single is station-to-station and scores the runner on third", () => {
    const result = applyPlay(
      doc,
      { ...sit, runners: { first: 301, third: 303 } },
      "single"
    );
    expect(result.situation.runners).toEqual({ first: 201, second: 301 });
    expect(result.situation.awayScore).toBe(1);
    expect(result.situation.batterId).toBe(204);
  });

  it("double advances two bases", () => {
    const result = applyPlay(
      doc,
      { ...sit, runners: { first: 301, second: 302 } },
      "double"
    );
    expect(result.situation.runners).toEqual({ second: 201, third: 301 });
    expect(result.situation.awayScore).toBe(1);
  });

  it("home run clears the bases and scores everyone", () => {
    const result = applyPlay(
      doc,
      { ...sit, runners: { first: 301, second: 302, third: 303 }, homeScore: 1 },
      "home_run"
    );
    expect(result.situation.runners).toEqual({});
    expect(result.situation.awayScore).toBe(4);
    expect(result.situation.homeScore).toBe(1);
    expect(result.situation.batterId).toBe(204);
  });
});

describe("applyPlay outs", () => {
  it("strikeout and in-play out both record one out but keep distinct copy", () => {
    const k = applyPlay(doc, { ...sit, runners: { first: 300 }, outs: 0 }, "strikeout");
    const bip = applyPlay(doc, { ...sit, runners: { first: 300 }, outs: 0 }, "out");
    expect(k.situation.outs).toBe(1);
    expect(bip.situation.outs).toBe(1);
    expect(k.situation.runners).toEqual({ first: 300 });
    expect(bip.situation.runners).toEqual({ first: 300 });
    expect(k.situation.batterId).toBe(204);
    expect(k.description).toBe("Strikeout");
    expect(bip.description).toBe("In-play out");
  });

  it("in-play out with 2 outs ends the half inning", () => {
    const result = applyPlay(doc, { ...sit, outs: 2 }, "out");
    expect(result.situation.halfInning).toBe("bottom");
    expect(result.situation.outs).toBe(0);
    expect(result.description).toContain("third out");
  });

  it("sac fly scores the runner on third and records an out", () => {
    const result = applyPlay(doc, { ...sit, runners: { first: 301, third: 303 }, outs: 0 }, "sac_fly");
    expect(result.situation.runners).toEqual({ first: 301 });
    expect(result.situation.awayScore).toBe(1);
    expect(result.situation.outs).toBe(1);
    expect(result.description).toBe("Sacrifice fly");
  });

  it("does not apply sac fly when prerequisites fail", () => {
    const result = applyPlay(doc, { ...sit, runners: { first: 301 }, outs: 0 }, "sac_fly");
    expect(result.situation).toEqual({ ...sit, runners: { first: 301 }, outs: 0 });
    expect(result.description).toBe("");
  });

  it("double play retires the runner on first and the batter", () => {
    const result = applyPlay(doc, { ...sit, runners: { first: 301, second: 302 }, outs: 0 }, "double_play");
    expect(result.situation.runners).toEqual({ second: 302 });
    expect(result.situation.outs).toBe(2);
    expect(result.situation.batterId).toBe(204);
    expect(result.description).toBe("Double play");
  });

  it("double play with 1 out ends the inning", () => {
    const result = applyPlay(doc, { ...sit, runners: { first: 301 }, outs: 1 }, "double_play");
    expect(result.situation.halfInning).toBe("bottom");
    expect(result.situation.outs).toBe(0);
    expect(result.situation.runners).toEqual({});
    expect(result.description).toContain("third out");
  });

  it("double play without a runner on first retires the lead runner", () => {
    const result = applyPlay(doc, { ...sit, runners: { third: 303 }, outs: 0 }, "double_play");
    expect(result.situation.runners).toEqual({});
    expect(result.situation.outs).toBe(2);
  });
});
