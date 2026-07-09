import { BRANCH_SCHEMA_VERSION, type BranchDocument } from "../branch/branchTypes";
import { sanitizeBranchImport, sanitizeSituationPatch } from "../branch/branchImportValidation";
import { HttpError } from "../utils/httpErrors";

function validImport(overrides: Partial<BranchDocument> = {}): BranchDocument {
  const base: BranchDocument = {
    schemaVersion: BRANCH_SCHEMA_VERSION,
    branchId: "imported-branch",
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
    playerNames: { 660271: "Test Batter" },
    teams: {
      home: {
        teamId: 134,
        battingOrder: [660271],
        bench: [123456],
        bullpen: [605483],
        defense: { catcher: 660271 },
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
    situation: {
      inning: 5,
      halfInning: "top",
      balls: 1,
      strikes: 2,
      outs: 1,
      runners: { first: 660271 },
      homeScore: 1,
      awayScore: 2,
      batterId: 660271,
      pitcherId: 605483,
      battingTeamId: 133,
      fieldingTeamId: 134,
      homeChallengesRemaining: 2,
      awayChallengesRemaining: 1,
    },
    forkSnapshot: {
      situation: {
        inning: 5,
        halfInning: "top",
        balls: 0,
        strikes: 0,
        outs: 0,
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
      checkpoint: { atBatIndex: 0 },
      playerNames: { 660271: "Test Batter" },
    },
    previewGrid: { cells: [] } as never,
    previewGridComputedAt: "2026-01-01T00:00:00.000Z",
    atBatHistory: { atBats: [] } as never,
  };
  return { ...base, ...overrides };
}

describe("sanitizeBranchImport", () => {
  it("accepts a valid branch document and strips cached preview fields", () => {
    const doc = sanitizeBranchImport(validImport());
    expect(doc.parentGamePk).toBe(777001);
    expect(doc.previewGrid).toBeUndefined();
    expect(doc.previewGridComputedAt).toBeUndefined();
    expect(doc.atBatHistory).toBeUndefined();
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      sanitizeBranchImport(validImport({ schemaVersion: 99 as never }))
    ).toThrow(HttpError);
  });

  it("rejects invalid situation counts", () => {
    const raw = validImport();
    raw.situation.balls = 9;
    expect(() => sanitizeBranchImport(raw)).toThrow(HttpError);
  });

  it("rejects branchId mismatch on restore", () => {
    expect(() => sanitizeBranchImport(validImport(), "other-id")).toThrow(HttpError);
  });

  it("ignores unknown top-level fields", () => {
    const raw = {
      ...validImport(),
      evil: { nested: true },
      __proto__: { polluted: true },
    };
    const doc = sanitizeBranchImport(raw);
    expect("evil" in doc).toBe(false);
  });

  it("rejects invalid situation patches", () => {
    const current = validImport().situation;
    expect(() => sanitizeSituationPatch({ balls: 9 }, current)).toThrow(HttpError);
  });

  it("merges valid situation patches", () => {
    const current = validImport().situation;
    const next = sanitizeSituationPatch({ balls: 2 }, current);
    expect(next.balls).toBe(2);
    expect(next.strikes).toBe(current.strikes);
  });
});
