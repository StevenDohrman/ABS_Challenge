import {
  resolveForkSituation,
  snapshotToSituation,
  SnapshotSituationSeed,
} from "../services/gameExportSituation";
import { BranchSituation } from "../branch/branchTypes";

function makeSnap(overrides: Partial<SnapshotSituationSeed> = {}): SnapshotSituationSeed {
  return {
    atBatIndex: 4,
    inning: 2,
    halfInning: "top",
    outs: 1,
    runnerOnFirst: true,
    runnerOnSecond: false,
    runnerOnThird: false,
    runnerFirstId: 301,
    runnerSecondId: null,
    runnerThirdId: null,
    homeScore: 1,
    awayScore: 2,
    batterId: 201,
    pitcherId: 101,
    battingTeamId: 20,
    fieldingTeamId: 10,
    ...overrides,
  };
}

function makeLive(overrides: Partial<BranchSituation> = {}): BranchSituation {
  return {
    inning: 5,
    halfInning: "bottom",
    balls: 2,
    strikes: 1,
    outs: 2,
    runners: { second: 401 },
    homeScore: 4,
    awayScore: 3,
    batterId: 505,
    pitcherId: 606,
    battingTeamId: 10,
    fieldingTeamId: 20,
    homeChallengesRemaining: 2,
    awayChallengesRemaining: 1,
    ...overrides,
  };
}

describe("resolveForkSituation", () => {
  it("prefers live current play over a stale latest snapshot", () => {
    const live = makeLive();
    const resolved = resolveForkSituation({
      snapshots: [makeSnap({ atBatIndex: 4, batterId: 201 })],
      liveSituation: live,
      liveAtBatIndex: 18,
      homeChallenges: 2,
      awayChallenges: 1,
    });

    expect(resolved.source).toBe("live");
    expect(resolved.situation?.batterId).toBe(505);
    expect(resolved.situation?.inning).toBe(5);
    expect(resolved.checkpoint).toEqual({ atBatIndex: 18, label: "Current play" });
  });

  it("uses an explicit snapshot checkpoint when requested", () => {
    const resolved = resolveForkSituation({
      checkpointAtBatIndex: 4,
      snapshots: [
        makeSnap({ atBatIndex: 3, batterId: 199 }),
        makeSnap({ atBatIndex: 4, batterId: 201 }),
      ],
      liveSituation: makeLive(),
      liveAtBatIndex: 18,
      homeChallenges: 2,
      awayChallenges: 2,
    });

    expect(resolved.source).toBe("checkpoint");
    expect(resolved.situation?.batterId).toBe(201);
    expect(resolved.checkpoint.label).toBe("At-bat 4");
  });

  it("falls back to the latest snapshot when the live feed has no matchup", () => {
    const resolved = resolveForkSituation({
      snapshots: [makeSnap({ atBatIndex: 4, batterId: 201 })],
      liveSituation: null,
      homeChallenges: 2,
      awayChallenges: 2,
    });

    expect(resolved.source).toBe("snapshot");
    expect(resolved.situation?.batterId).toBe(201);
    expect(resolved.checkpoint.label).toBe("Latest snapshot");
  });

  it("returns no situation when there is no live play and no snapshots", () => {
    const resolved = resolveForkSituation({
      snapshots: [],
      liveSituation: null,
      homeChallenges: 2,
      awayChallenges: 2,
    });

    expect(resolved.source).toBe("none");
    expect(resolved.situation).toBeNull();
    expect(resolved.checkpoint.label).toBe("Pregame / warmup");
  });
});

describe("snapshotToSituation", () => {
  it("keeps named runners and clamps outs", () => {
    const sit = snapshotToSituation(
      makeSnap({ outs: 3, runnerOnThird: true, runnerThirdId: 333 }),
      2,
      1,
      { balls: 3, strikes: 2 }
    );
    expect(sit.outs).toBe(2);
    expect(sit.runners).toEqual({ first: 301, third: 333 });
    expect(sit.balls).toBe(3);
    expect(sit.strikes).toBe(2);
  });
});
