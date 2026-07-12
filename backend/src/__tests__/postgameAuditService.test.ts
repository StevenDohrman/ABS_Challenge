import {
  deriveMlbZoneResult,
  buildBattingAuditInput,
  buildFieldingAuditInput,
  computeCalculatedReSwing,
} from "../services/postgameAuditService";
import type { ChallengeRecommendation, LivePitchEvent } from "@prisma/client";
import { CALLED_STRIKE_CALL_CODE } from "@abs/data-pipeline";
import { CALL_CODES } from "../db/constants";

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

const snapshot = {
  outs: 1,
  runnerOnFirst: true,
  runnerOnSecond: false,
  runnerOnThird: false,
  fieldingTeamId: 111,
  battingTeamId: 147,
};

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
});

describe("buildBattingAuditInput", () => {
  it("flags missed challenge from calculated RE when zone says ball", () => {
    const pitch = makePitch();
    const audit = buildBattingAuditInput(pitch, snapshot, makeRec(), true);
    const expectedRe = computeCalculatedReSwing(pitch, snapshot);

    expect(audit).not.toBeNull();
    expect(audit!.challengeSide).toBe("batting");
    expect(audit!.callWasProbablyWrong).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.runExpectancySwing).toBeCloseTo(expectedRe, 5);
    expect(audit!.runExpectancySwing).not.toBe(0.14);
  });

  it("counts DENY recommendations when zone disagrees with the call", () => {
    const pitch = makePitch();
    const audit = buildBattingAuditInput(
      pitch,
      snapshot,
      makeRec({ recommendation: "DENY", expectedValue: 0 }),
      true
    );

    expect(audit!.callWasProbablyWrong).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.runExpectancySwing).toBeGreaterThan(0);
  });

  it("includes out-of-challenges misses in missedChallenge", () => {
    const audit = buildBattingAuditInput(
      makePitch(),
      snapshot,
      makeRec({ challengeAvailable: false }),
      false
    );
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.challengeAvailable).toBe(false);
  });

  it("does not flag missed when team overturned the call", () => {
    const audit = buildBattingAuditInput(
      makePitch({ hasReview: true, isOverturned: true }),
      snapshot,
      makeRec(),
      true
    );
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(false);
  });

  it("flags bad challenge when DENY rec but team challenged", () => {
    const audit = buildBattingAuditInput(
      makePitch({ hasReview: true, isOverturned: false, mlbZone: 5, plateX: 0.1, plateZ: 2.5 }),
      snapshot,
      makeRec({ recommendation: "DENY" }),
      true
    );
    expect(audit!.badChallengeAllowed).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(false);
  });

  it("returns null for non-called-strike pitches", () => {
    expect(
      buildBattingAuditInput(makePitch({ callCode: "B" }), snapshot, makeRec(), true)
    ).toBeNull();
  });

  it("does not count misses when zone agrees with the call", () => {
    const audit = buildBattingAuditInput(
      makePitch({ mlbZone: 5, plateX: 0.1, plateZ: 2.5 }),
      snapshot,
      makeRec(),
      true
    );
    expect(audit!.callWasProbablyWrong).toBe(false);
    expect(audit!.missedChallenge).toBe(false);
  });
});

describe("buildFieldingAuditInput", () => {
  it("flags missed fielding challenge when ball call is actually a strike", () => {
    const pitch = makePitch({
      callCode: CALL_CODES.BALL,
      mlbZone: 5,
      plateX: 0.1,
      plateZ: 2.5,
      ballsBefore: 3,
      strikesBefore: 0,
      outs: 0,
    });
    const fieldingSnapshot = {
      outs: 0,
      runnerOnFirst: true,
      runnerOnSecond: false,
      runnerOnThird: false,
      fieldingTeamId: 111,
      battingTeamId: 147,
    };
    const audit = buildFieldingAuditInput(pitch, fieldingSnapshot, true);

    expect(audit).not.toBeNull();
    expect(audit!.challengeSide).toBe("fielding");
    expect(audit!.callWasProbablyWrong).toBe(true);
    expect(audit!.shouldHaveChallenged).toBe(true);
    expect(audit!.missedChallenge).toBe(true);
    expect(audit!.runExpectancySwing).toBeCloseTo(
      computeCalculatedReSwing(pitch, fieldingSnapshot),
      5
    );
  });

  it("does not flag missed when fielding team overturned the call", () => {
    const audit = buildFieldingAuditInput(
      makePitch({
        callCode: CALL_CODES.BALL,
        mlbZone: 5,
        plateX: 0.1,
        plateZ: 2.5,
        hasReview: true,
        isOverturned: true,
      }),
      snapshot,
      true
    );

    expect(audit!.missedChallenge).toBe(false);
  });
});
