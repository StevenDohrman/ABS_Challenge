import { describe, it, expect, beforeEach, vi } from "vitest";
import { BRANCH_SCHEMA_VERSION } from "../state/branchTypes";
import type { BranchDocument } from "../state/branchTypes";
import {
  MAX_LOCAL_BRANCHES,
  listLocalBranches,
  readLocalBranch,
  removeLocalBranch,
  writeLocalBranch,
  cacheKey,
} from "./localCache";

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  } as Storage;
}

let local: Storage;
let session: Storage;

function makeDoc(id: string, forkedAt: string): BranchDocument {
  return {
    schemaVersion: BRANCH_SCHEMA_VERSION,
    branchId: id,
    parentGamePk: 100,
    forkedAt,
    checkpoint: {},
    schedule: {
      gamePk: 100,
      officialDate: "2026-07-06",
      scheduledStartTime: "2026-07-06T00:00:00Z",
      abstractState: "Final",
      detailedState: "Final",
      homeTeamId: 1,
      awayTeamId: 2,
      homeTeamName: "Home",
      awayTeamName: "Away",
      homeTeamAbbrev: "HOM",
      awayTeamAbbrev: "AWY",
      homeScore: 3,
      awayScore: 5,
      currentInning: 9,
      currentInningHalf: "Bottom",
      balls: 0,
      strikes: 0,
      outs: 0,
      isTracked: false,
      hasTriggeredRecommendation: false,
      homeChallengesRemaining: null,
      awayChallengesRemaining: null,
    },
    playerNames: {},
    teams: {
      home: {
        teamId: 1,
        battingOrder: [],
        bench: [],
        bullpen: [],
        defense: {},
        removedFromGame: [],
      },
      away: {
        teamId: 2,
        battingOrder: [],
        bench: [],
        bullpen: [],
        defense: {},
        removedFromGame: [],
      },
    },
    situation: {
      inning: 5,
      halfInning: "top",
      balls: 0,
      strikes: 0,
      outs: 1,
      runners: {},
      homeScore: 3,
      awayScore: 5,
      batterId: 1,
      pitcherId: 2,
      battingTeamId: 2,
      fieldingTeamId: 1,
      homeChallengesRemaining: 2,
      awayChallengesRemaining: 2,
    },
  };
}

describe("localCache", () => {
  beforeEach(() => {
    local = createStorage();
    session = createStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("window", { localStorage: local, sessionStorage: session });
    local.clear();
    session.clear();
  });

  it("lists written branches newest first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
    writeLocalBranch(makeDoc("a", "2026-07-01T00:00:00Z"));
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    writeLocalBranch(makeDoc("b", "2026-07-02T00:00:00Z"));
    const list = listLocalBranches();
    expect(list.map((e) => e.branchId)).toEqual(["b", "a"]);
    vi.useRealTimers();
  });

  it("reads a stored branch document", () => {
    const doc = makeDoc("x", "2026-07-01T00:00:00Z");
    writeLocalBranch(doc);
    expect(readLocalBranch("x")?.branchId).toBe("x");
  });

  it("evicts oldest branches when over the cap", () => {
    for (let i = 0; i < MAX_LOCAL_BRANCHES + 2; i++) {
      const id = `branch-${String(i).padStart(2, "0")}`;
      writeLocalBranch(makeDoc(id, `2026-07-01T00:00:${String(i).padStart(2, "0")}Z`));
    }
    expect(listLocalBranches()).toHaveLength(MAX_LOCAL_BRANCHES);
    expect(local.getItem(cacheKey("branch-00"))).toBeNull();
    expect(local.getItem(cacheKey("branch-01"))).toBeNull();
    expect(local.getItem(cacheKey("branch-16"))).not.toBeNull();
  });

  it("removes a branch from storage and index", () => {
    writeLocalBranch(makeDoc("del-me", "2026-07-01T00:00:00Z"));
    removeLocalBranch("del-me");
    expect(readLocalBranch("del-me")).toBeNull();
    expect(listLocalBranches()).toHaveLength(0);
  });
});
