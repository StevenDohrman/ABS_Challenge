import {
  deriveMlbZoneResult,
  buildAuditInput,
} from "../services/postgameAuditService";
import type { ChallengeRecommendation, LivePitchEvent } from "@prisma/client";
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
    plateX: 0.95,
    plateZ: 2.1,
    strikeZoneTop: 3.5,
    strikeZoneBottom: 1.6,
    mlbZone: 13,
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

describe("deriveMlbZoneResult", () => {
  it("returns strike for in-zone MLB zones 1-9", () => {
    expect(deriveMlbZoneResult(5, null, null, null, null)).toBe("strike");
  });

  it("returns ball for shadow zones 11-14", () => {
    expect(deriveMlbZoneResult(13, null, null, null, null)).toBe("ball");
  });

  it("falls back to plate location vs zone bounds", () => {
    expect(deriveMlbZoneResult(null, 0.1, 2.5, 3.5, 1.6)).toBe("strike");
    expect(deriveMlbZoneResult(null, 1.2, 2.5, 3.5, 1.6)).toBe("ball");
  });

  it("returns unknown when data is insufficient", () => {
    expect(deriveMlbZoneResult(null, null, null, null, null)).toBe("unknown");
  });

  it("classifies edge of plate at half-width boundary as strike", () => {
    expect(deriveMlbZoneResult(null, 0.83, 2.5, 3.5, 1.6)).toBe("strike");
    expect(deriveMlbZoneResult(null, 0.84, 2.5, 3.5, 1.6)).toBe("ball");
  });

  it("classifies high and low pitches outside zone height", () => {
    expect(deriveMlbZoneResult(null, 0.1, 3.6, 3.5, 1.6)).toBe("ball");
    expect(deriveMlbZoneResult(null, 0.1, 1.5, 3.5, 1.6)).toBe("ball");
  });
});

describe("buildAuditInput", () => {
  it("flags missed challenge when ALLOW rec and MLB location says ball", () => {
    const audit = buildAuditInput(makePitch(), makeRec());
    expect(audit).not.toBeNull();
    expect(audit!.callWasProbablyWrong).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.runExpectancySwing).toBe(0.14);
  });

  it("includes out-of-challenges misses in missedChallenge", () => {
    const audit = buildAuditInput(
      makePitch(),
      makeRec({ challengeAvailable: false })
    );
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.challengeAvailable).toBe(false);
  });

  it("does not flag missed when team overturned the call", () => {
    const audit = buildAuditInput(
      makePitch({ hasReview: true, isOverturned: true }),
      makeRec()
    );
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(false);
  });

  it("flags bad challenge when DENY rec but team challenged", () => {
    const audit = buildAuditInput(
      makePitch({ hasReview: true, isOverturned: false, mlbZone: 5, plateX: 0.1, plateZ: 2.5 }),
      makeRec({ recommendation: "DENY" })
    );
    expect(audit!.badChallengeAllowed).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(false);
  });

  it("returns null for non-called-strike pitches", () => {
    expect(buildAuditInput(makePitch({ callCode: "B" }), makeRec())).toBeNull();
  });

  it("marks zoneResult unknown when pitch location is missing", () => {
    const audit = buildAuditInput(
      makePitch({
        plateX: null,
        plateZ: null,
        strikeZoneTop: null,
        strikeZoneBottom: null,
        mlbZone: null,
      }),
      makeRec()
    );
    expect(audit!.zoneResult).toBe("unknown");
    expect(audit!.notes).toContain("No pitch location data in MLB live feed");
  });
});
