import {
  deriveSavantZoneResult,
  buildAuditInput,
} from "../services/postgameAuditService";
import type { ChallengeRecommendation, LivePitchEvent, SavantPitchEvent } from "@prisma/client";
import { CALLED_STRIKE_CALL_CODE } from "@abs/data-pipeline";

function makePitch(overrides: Partial<LivePitchEvent> = {}): LivePitchEvent {
  return {
    id: 1,
    gamePk: 824991,
    playId: null,
    atBatIndex: 0,
    pitchNumber: 1,
    inning: 1,
    halfInning: "top",
    ballsBefore: 1,
    strikesBefore: 2,
    balls: 1,
    strikes: 3,
    outs: 1,
    batterId: 682998,
    pitcherId: 656731,
    callCode: CALLED_STRIKE_CALL_CODE,
    callDescription: "Called Strike",
    hasReview: false,
    isOverturned: null,
    challengerName: null,
    challengerTeamId: null,
    fetchedAt: new Date(),
    rawPayload: {},
    ...overrides,
  };
}

function makeRec(overrides: Partial<ChallengeRecommendation> = {}): ChallengeRecommendation {
  return {
    id: 10,
    gamePk: 824991,
    atBatIndex: 0,
    balls: 1,
    strikes: 2,
    recommendation: "ALLOW",
    minimumConfidenceRequired: 60,
    expectedValue: 0.14,
    score: 72,
    challengeAvailable: true,
    explanationJson: [],
    createdAt: new Date(),
    triggeredAt: new Date(),
    pitchEventId: 1,
    ...overrides,
  };
}

function makeSavant(overrides: Partial<SavantPitchEvent> = {}): SavantPitchEvent {
  return {
    id: 100,
    gamePk: 824991,
    atBatNumber: 1,
    atBatIndex: 0,
    pitchNumber: 1,
    batterId: 682998,
    pitcherId: 656731,
    plateX: 0.95,
    plateZ: 2.1,
    szTop: 3.5,
    szBot: 1.6,
    zone: 13,
    description: "ball",
    fetchedAt: new Date(),
    rawPayload: {},
    ...overrides,
  };
}

describe("deriveSavantZoneResult", () => {
  it("returns strike for in-zone Savant zones 1-9", () => {
    expect(deriveSavantZoneResult(5, null, null, null, null)).toBe("strike");
  });

  it("returns ball for shadow zones 11-14", () => {
    expect(deriveSavantZoneResult(13, null, null, null, null)).toBe("ball");
  });

  it("falls back to plate location vs zone bounds", () => {
    expect(deriveSavantZoneResult(null, 0.1, 2.5, 3.5, 1.6)).toBe("strike");
    expect(deriveSavantZoneResult(null, 1.2, 2.5, 3.5, 1.6)).toBe("ball");
  });

  it("returns unknown when data is insufficient", () => {
    expect(deriveSavantZoneResult(null, null, null, null, null)).toBe("unknown");
  });
});

describe("buildAuditInput", () => {
  it("flags missed challenge when ALLOW rec and Savant says ball", () => {
    const audit = buildAuditInput(makePitch(), makeRec(), makeSavant());
    expect(audit).not.toBeNull();
    expect(audit!.callWasProbablyWrong).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.runExpectancySwing).toBe(0.14);
  });

  it("includes out-of-challenges misses in missedChallenge", () => {
    const audit = buildAuditInput(
      makePitch(),
      makeRec({ challengeAvailable: false }),
      makeSavant()
    );
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.challengeAvailable).toBe(false);
  });

  it("does not flag missed when team overturned the call", () => {
    const audit = buildAuditInput(
      makePitch({ hasReview: true, isOverturned: true }),
      makeRec(),
      makeSavant()
    );
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(false);
  });

  it("flags bad challenge when DENY rec but team challenged", () => {
    const audit = buildAuditInput(
      makePitch({ hasReview: true, isOverturned: false }),
      makeRec({ recommendation: "DENY" }),
      makeSavant({ zone: 5 })
    );
    expect(audit!.badChallengeAllowed).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(false);
  });

  it("returns null for non-called-strike pitches", () => {
    expect(buildAuditInput(makePitch({ callCode: "B" }), makeRec(), makeSavant())).toBeNull();
  });
});

describe("atBatIndex join mapping", () => {
  it("maps Savant atBatNumber 1 to atBatIndex 0", () => {
    const savant = makeSavant({ atBatNumber: 1, atBatIndex: 0 });
    const pitch = makePitch({ atBatIndex: 0 });
    const audit = buildAuditInput(pitch, makeRec(), savant);
    expect(audit!.atBatIndex).toBe(0);
  });
});
