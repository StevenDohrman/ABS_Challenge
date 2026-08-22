import { describe, it, expect } from "vitest";
import { BRANCH_SCHEMA_VERSION, type BranchDocument } from "../state/branchTypes";
import { advanceRunner, retireRunner, validateRunners, clampCount } from "./runners";

const doc = {
  schemaVersion: BRANCH_SCHEMA_VERSION,
  schedule: { homeTeamId: 10, awayTeamId: 20 },
  teams: {
    home: { battingOrder: [101], defense: { pitcher: 103 } },
    away: { battingOrder: [201], defense: { pitcher: 202 } },
  },
} as unknown as BranchDocument;

const sit = {
  inning: 1,
  halfInning: "top" as const,
  balls: 1,
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
};

describe("validateRunners", () => {
  it("warns on duplicate runner ids", () => {
    const warnings = validateRunners({ first: 1, second: 1 });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("passes for distinct runners", () => {
    expect(validateRunners({ first: 1, third: 2 })).toEqual([]);
  });
});

describe("clampCount", () => {
  it("clamps to range", () => {
    expect(clampCount(5, 3)).toBe(3);
    expect(clampCount(-1, 3)).toBe(0);
  });
});

describe("advanceRunner", () => {
  it("moves a runner one base when the next bag is empty", () => {
    const result = advanceRunner({ ...sit, runners: { first: 301 } }, "first");
    expect(result?.situation.runners).toEqual({ second: 301 });
    expect(result?.situation.awayScore).toBe(0);
    expect(result?.situation.balls).toBe(1);
  });

  it("scores from third and cascades when the next bag is occupied", () => {
    const result = advanceRunner(
      { ...sit, runners: { first: 301, second: 302, third: 303 } },
      "first"
    );
    expect(result?.situation.runners).toEqual({ second: 301, third: 302 });
    expect(result?.situation.awayScore).toBe(1);
    expect(result?.description).toBe("Runner scores");
  });
});

describe("retireRunner", () => {
  it("removes the runner and adds an out", () => {
    const result = retireRunner(doc, { ...sit, runners: { second: 302 }, outs: 0 }, "second");
    expect(result?.situation.runners).toEqual({});
    expect(result?.situation.outs).toBe(1);
    expect(result?.situation.batterId).toBe(201);
  });

  it("ends the half inning on the third out", () => {
    const result = retireRunner(doc, { ...sit, runners: { first: 301 }, outs: 2 }, "first");
    expect(result?.situation.halfInning).toBe("bottom");
    expect(result?.situation.outs).toBe(0);
    expect(result?.situation.runners).toEqual({});
  });
});
