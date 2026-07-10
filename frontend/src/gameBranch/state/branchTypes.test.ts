import { describe, it, expect } from "vitest";
import { branchReducer, BRANCH_SCHEMA_VERSION } from "./branchTypes";
import { applyPlay } from "../rules/plays";
import { endHalfInning } from "../rules/inningProgression";

const baseDoc = {
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
  } as never,
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
    balls: 0,
    strikes: 0,
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
};

describe("branchReducer SWAP_BENCH_TO_LINEUP", () => {
  it("swaps bench player into lineup and removes replaced from game", () => {
    const loaded = {
      ...baseDoc,
      forkSnapshot: {
        situation: baseDoc.situation,
        teams: baseDoc.teams,
        checkpoint: {},
        playerNames: {},
      },
    };
    const next = branchReducer(loaded, {
      type: "SWAP_BENCH_TO_LINEUP",
      side: "home",
      slotIndex: 0,
      benchPlayerId: 102,
    });
    expect(next?.teams.home.battingOrder[0]).toBe(102);
    expect(next?.teams.home.removedFromGame).toContain(101);
    expect(next?.teams.home.bench).not.toContain(101);
  });
});

describe("branchReducer CHANGE_PITCHER", () => {
  it("pulls pitcher from bullpen and removes outgoing pitcher", () => {
    const loaded = {
      ...baseDoc,
      situation: { ...baseDoc.situation, fieldingTeamId: 10, pitcherId: 103 },
      forkSnapshot: {
        situation: baseDoc.situation,
        teams: baseDoc.teams,
        checkpoint: {},
        playerNames: {},
      },
    };
    loaded.teams.home.bullpen = [103, 105];
    loaded.teams.home.defense = { pitcher: 103 };

    const next = branchReducer(loaded, {
      type: "CHANGE_PITCHER",
      side: "home",
      pitcherId: 105,
    });
    expect(next?.teams.home.defense.pitcher).toBe(105);
    expect(next?.teams.home.bullpen).not.toContain(105);
    expect(next?.teams.home.removedFromGame).toContain(103);
    expect(next?.situation.pitcherId).toBe(105);
  });

  it("moves bench player to defense and replaces lineup slot", () => {
    const loaded = {
      ...baseDoc,
      teams: {
        ...baseDoc.teams,
        home: {
          ...baseDoc.teams.home,
          battingOrder: [101, 104],
          bench: [150],
          defense: { ...baseDoc.teams.home.defense, center: 101 },
        },
      },
      forkSnapshot: {
        situation: baseDoc.situation,
        teams: baseDoc.teams,
        checkpoint: {},
        playerNames: {},
      },
    };
    const next = branchReducer(loaded, {
      type: "SET_DEFENSE_SLOT",
      side: "home",
      slot: "center",
      playerId: 150,
    });
    expect(next?.teams.home.defense.center).toBe(150);
    expect(next?.teams.home.battingOrder[0]).toBe(150);
    expect(next?.teams.home.bench).not.toContain(150);
    expect(next?.teams.home.removedFromGame).toContain(101);
  });
});

describe("applyPlay", () => {
  it("walk advances forced runners and next batter", () => {
    const sit = {
      ...baseDoc.situation,
      runners: { first: 300 },
    };
    const result = applyPlay(baseDoc, sit, "walk");
    expect(result.situation.runners.first).toBe(201);
    expect(result.situation.runners.second).toBe(300);
    expect(result.situation.batterId).toBe(204);
  });

  it("third strikeout ends the half inning", () => {
    const sit = { ...baseDoc.situation, outs: 2 };
    const result = applyPlay(baseDoc, sit, "strikeout");
    expect(result.description).toContain("Third out");
    expect(result.situation.outs).toBe(0);
    expect(result.situation.halfInning).toBe("bottom");
    expect(result.situation.runners).toEqual({});
  });
});

describe("endHalfInning", () => {
  it("switches to home batting on bottom half", () => {
    const ended = endHalfInning(baseDoc, { ...baseDoc.situation, outs: 3 });
    expect(ended.halfInning).toBe("bottom");
    expect(ended.battingTeamId).toBe(10);
    expect(ended.fieldingTeamId).toBe(20);
    expect(ended.outs).toBe(0);
  });
});
