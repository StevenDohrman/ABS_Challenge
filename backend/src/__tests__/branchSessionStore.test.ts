import {
  saveBranch,
  getBranch,
  updateBranch,
  deleteBranch,
  resetBranchSessionStoreForTests,
  expireBranchesForTests,
  parseBranchSessionCookie,
  createBranchSessionCookie,
} from "../branch/branchSessionStore";
import { BRANCH_SCHEMA_VERSION, type BranchDocument } from "../branch/branchTypes";

function minimalBranch(branchId: string): BranchDocument {
  return {
    schemaVersion: BRANCH_SCHEMA_VERSION,
    branchId,
    parentGamePk: 777001,
    forkedAt: new Date().toISOString(),
    checkpoint: { atBatIndex: 0 },
    schedule: {
      gamePk: 777001,
      officialDate: "2026-07-05",
      scheduledStartTime: "2026-07-05T19:00:00Z",
      abstractState: "Live",
      detailedState: "In Progress",
      homeTeamId: 134,
      homeTeamName: "Pittsburgh Pirates",
      homeTeamAbbrev: "PIT",
      awayTeamId: 133,
      awayTeamName: "Oakland Athletics",
      awayTeamAbbrev: "OAK",
      homeScore: 1,
      awayScore: 2,
      currentInning: 5,
      currentInningHalf: "Top",
      balls: 1,
      strikes: 2,
      outs: 1,
      isTracked: true,
      hasTriggeredRecommendation: false,
      homeChallengesRemaining: 2,
      awayChallengesRemaining: 1,
    },
    playerNames: { 660271: "Test Batter", 605483: "Test Pitcher" },
    teams: {
      home: {
        teamId: 134,
        battingOrder: [660271],
        bench: [],
        bullpen: [],
        defense: {},
        removedFromGame: [],
      },
      away: {
        teamId: 133,
        battingOrder: [605483],
        bench: [],
        bullpen: [],
        defense: {},
        removedFromGame: [],
      },
    },
    forkSnapshot: {
      situation: {} as never,
      teams: {} as never,
      checkpoint: {},
      playerNames: {},
    },
    situation: {
      inning: 5,
      halfInning: "top",
      balls: 1,
      strikes: 2,
      outs: 1,
      runners: {},
      homeScore: 1,
      awayScore: 2,
      batterId: 660271,
      pitcherId: 605483,
      battingTeamId: 133,
      fieldingTeamId: 134,
      homeChallengesRemaining: 2,
      awayChallengesRemaining: 1,
    },
  };
}

describe("branchSessionStore", () => {
  beforeEach(() => {
    resetBranchSessionStoreForTests();
  });

  it("saves and loads a branch for the owning session", () => {
    const doc = minimalBranch("branch-a");
    const { sessionId, cookie } = saveBranch(doc, null);
    const parsed = parseBranchSessionCookie(`branchSession=${encodeURIComponent(cookie.split("=")[1].split(";")[0])}`);
    expect(parsed).toBe(sessionId);
    expect(getBranch("branch-a", sessionId)).toEqual(doc);
  });

  it("rejects access from a different session", () => {
    const doc = minimalBranch("branch-b");
    const { sessionId } = saveBranch(doc, null);
    expect(getBranch("branch-b", "other-session")).toBeNull();
    expect(getBranch("branch-b", sessionId)).not.toBeNull();
  });

  it("rejects access without a session cookie", () => {
    const doc = minimalBranch("branch-no-session");
    saveBranch(doc, null);
    expect(getBranch("branch-no-session", null)).toBeNull();
  });

  it("allows new branches after expired branches are swept", () => {
    const { sessionId } = saveBranch(minimalBranch("expired-1"), null);
    const ids = ["expired-1"];
    for (let i = 2; i <= 10; i++) {
      const id = `expired-${i}`;
      saveBranch(minimalBranch(id), sessionId);
      ids.push(id);
    }

    expireBranchesForTests(ids);
    saveBranch(minimalBranch("fresh-branch"), sessionId);
    expect(getBranch("fresh-branch", sessionId)).not.toBeNull();
  });

  it("patches situation via updater", () => {
    const doc = minimalBranch("branch-c");
    const { sessionId } = saveBranch(doc, null);
    const updated = updateBranch("branch-c", sessionId, (current) => ({
      ...current,
      situation: { ...current.situation, balls: 3 },
    }));
    expect(updated?.situation.balls).toBe(3);
  });

  it("deletes a branch", () => {
    const doc = minimalBranch("branch-d");
    const { sessionId } = saveBranch(doc, null);
    expect(deleteBranch("branch-d", sessionId)).toBe(true);
    expect(getBranch("branch-d", sessionId)).toBeNull();
  });

  it("creates a signed session cookie", () => {
    expect(createBranchSessionCookie("abc")).toContain("branchSession=");
  });
});
