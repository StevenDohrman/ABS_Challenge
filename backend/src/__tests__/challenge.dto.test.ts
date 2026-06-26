import { toRecommendationDto } from "../challenge.dto";
import { makeChallengeRecommendation, makeLiveGameSnapshot } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// toRecommendationDto — field mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("toRecommendationDto — field mapping", () => {
  const rec = makeChallengeRecommendation({
    gamePk: 824991,
    balls: 2,
    strikes: 1,
    recommendation: "ALLOW",
    minimumConfidenceRequired: 55,
    expectedValue: 0.08,
    score: 62,
    explanationJson: ["High leverage.", "Disciplined batter."],
    triggeredAt: new Date("2026-06-22T21:06:00Z"),
  });
  const snapshot = makeLiveGameSnapshot({
    inning: 8,
    halfInning: "bottom",
    outs: 2,
    runnerOnFirst: true,
    runnerOnSecond: false,
    runnerOnThird: false,
  });
  const dto = toRecommendationDto(rec, snapshot);

  it("copies gamePk", () => {
    expect(dto.gamePk).toBe(824991);
  });

  it("formats count as 'balls-strikes'", () => {
    expect(dto.count).toBe("2-1");
  });

  it("copies inning from snapshot", () => {
    expect(dto.inning).toBe(8);
  });

  it("formats halfInning as 'Top' or 'Bot'", () => {
    expect(dto.halfInning).toBe("Bot");
  });

  it("formats top halfInning as 'Top'", () => {
    const topSnapshot = makeLiveGameSnapshot({ halfInning: "top" });
    const topDto = toRecommendationDto(rec, topSnapshot);
    expect(topDto.halfInning).toBe("Top");
  });

  it("copies outs from snapshot", () => {
    expect(dto.outs).toBe(2);
  });

  it("copies recommendation label", () => {
    expect(dto.recommendation).toBe("ALLOW");
  });

  it("copies minimumConfidenceThreshold from the engine output", () => {
    expect(dto.minimumConfidenceThreshold).toBe(55);
  });

  it("copies expectedValue", () => {
    expect(dto.expectedValue).toBeCloseTo(0.08);
  });

  it("copies score", () => {
    expect(dto.score).toBeCloseTo(62);
  });

  it("maps explanationJson array to reasons", () => {
    expect(dto.reasons).toEqual(["High leverage.", "Disciplined batter."]);
  });

  it("exposes triggeredAt as an ISO string", () => {
    expect(dto.triggeredAt).toBe("2026-06-22T21:06:00.000Z");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toRecommendationDto — display messages
// ─────────────────────────────────────────────────────────────────────────────

describe("toRecommendationDto — display messages", () => {
  const snapshot = makeLiveGameSnapshot();

  const LABELS = ["AUTO_ALLOW", "ALLOW", "WARN", "DENY"] as const;

  it.each(LABELS)("produces a non-empty displayMessage for %s", (label) => {
    const rec = makeChallengeRecommendation({ recommendation: label });
    const dto = toRecommendationDto(rec, snapshot);
    expect(typeof dto.displayMessage).toBe("string");
    expect(dto.displayMessage.length).toBeGreaterThan(0);
  });

  it("AUTO_ALLOW display message conveys a strong positive signal", () => {
    const rec = makeChallengeRecommendation({ recommendation: "AUTO_ALLOW" });
    const dto = toRecommendationDto(rec, snapshot);
    // Message must mention challenging or high expected value
    expect(dto.displayMessage.toLowerCase()).toMatch(/challenge|strong|high/i);
  });

  it("DENY display message conveys a negative signal", () => {
    const rec = makeChallengeRecommendation({ recommendation: "DENY" });
    const dto = toRecommendationDto(rec, snapshot);
    expect(dto.displayMessage.toLowerCase()).toMatch(/do not|not|low|too/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toRecommendationDto — challenge availability (missed opportunities)
// ─────────────────────────────────────────────────────────────────────────────

describe("toRecommendationDto — challenge availability", () => {
  const snapshot = makeLiveGameSnapshot();

  it("passes through challengeAvailable", () => {
    const rec = makeChallengeRecommendation({ challengeAvailable: false });
    const dto = toRecommendationDto(rec, snapshot);
    expect(dto.challengeAvailable).toBe(false);
  });

  it("reframes a positive call as a missed opportunity when out of challenges", () => {
    const rec = makeChallengeRecommendation({
      recommendation: "AUTO_ALLOW",
      challengeAvailable: false,
    });
    const dto = toRecommendationDto(rec, snapshot);
    expect(dto.displayMessage.toLowerCase()).toContain("out of challenges");
    expect(dto.displayMessage.toLowerCase()).toContain("missed opportunity");
  });

  it("uses the normal positive message when challenges are available", () => {
    const rec = makeChallengeRecommendation({
      recommendation: "AUTO_ALLOW",
      challengeAvailable: true,
    });
    const dto = toRecommendationDto(rec, snapshot);
    expect(dto.displayMessage.toLowerCase()).not.toContain("missed opportunity");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toRecommendationDto — base state formatting
// ─────────────────────────────────────────────────────────────────────────────

describe("toRecommendationDto — base state formatting", () => {
  const rec = makeChallengeRecommendation();

  it("'Bases empty' when no runners are on", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({
        runnerOnFirst: false,
        runnerOnSecond: false,
        runnerOnThird: false,
      })
    );
    expect(dto.baseState).toBe("Bases empty");
  });

  it("'Bases loaded' when runners are on all three bases", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({
        runnerOnFirst: true,
        runnerOnSecond: true,
        runnerOnThird: true,
      })
    );
    expect(dto.baseState).toBe("Bases loaded");
  });

  it("'Runner on 1st' when only first is occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: true, runnerOnSecond: false, runnerOnThird: false })
    );
    expect(dto.baseState).toBe("Runner on 1st");
  });

  it("'Runner on 2nd' when only second is occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: false, runnerOnSecond: true, runnerOnThird: false })
    );
    expect(dto.baseState).toBe("Runner on 2nd");
  });

  it("'Runner on 3rd' when only third is occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: false, runnerOnSecond: false, runnerOnThird: true })
    );
    expect(dto.baseState).toBe("Runner on 3rd");
  });

  it("'Runners on 1st and 2nd' when first and second are occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: true, runnerOnSecond: true, runnerOnThird: false })
    );
    expect(dto.baseState).toBe("Runners on 1st and 2nd");
  });

  it("'Runners on 1st and 3rd' when first and third are occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: true, runnerOnSecond: false, runnerOnThird: true })
    );
    expect(dto.baseState).toBe("Runners on 1st and 3rd");
  });

  it("'Runners on 2nd and 3rd' when second and third are occupied", () => {
    const dto = toRecommendationDto(
      rec,
      makeLiveGameSnapshot({ runnerOnFirst: false, runnerOnSecond: true, runnerOnThird: true })
    );
    expect(dto.baseState).toBe("Runners on 2nd and 3rd");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toRecommendationDto — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("toRecommendationDto — edge cases", () => {
  it("handles explanationJson that is not an array by returning an empty reasons array", () => {
    const rec = makeChallengeRecommendation({
      explanationJson: "unexpected string" as unknown as string[],
    });
    const dto = toRecommendationDto(rec, makeLiveGameSnapshot());
    expect(Array.isArray(dto.reasons)).toBe(true);
    expect(dto.reasons).toHaveLength(0);
  });

  it("uses a fallback triggeredAt when triggeredAt is null", () => {
    const rec = makeChallengeRecommendation({ triggeredAt: null });
    const dto = toRecommendationDto(rec, makeLiveGameSnapshot());
    // Should not throw and should return some string
    expect(typeof dto.triggeredAt).toBe("string");
    expect(dto.triggeredAt.length).toBeGreaterThan(0);
  });

  it("formats 0-0 count correctly", () => {
    const rec = makeChallengeRecommendation({ balls: 0, strikes: 0 });
    const dto = toRecommendationDto(rec, makeLiveGameSnapshot());
    expect(dto.count).toBe("0-0");
  });

  it("formats 3-2 count correctly", () => {
    const rec = makeChallengeRecommendation({ balls: 3, strikes: 2 });
    const dto = toRecommendationDto(rec, makeLiveGameSnapshot());
    expect(dto.count).toBe("3-2");
  });
});
