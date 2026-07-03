import { applyThresholds } from "../decision/thresholds";
import { computeChallengeScarcity } from "../features/challengeScarcity";
import { THRESHOLDS } from "../constants";

describe("applyThresholds", () => {
  test("score at AUTO_ALLOW boundary yields AUTO_ALLOW with 0 confidence", () => {
    const result = applyThresholds(THRESHOLDS.AUTO_ALLOW, computeChallengeScarcity(2));
    expect(result.recommendation).toBe("AUTO_ALLOW");
    expect(result.minimumPlayerConfidenceRequired).toBe(0);
  });

  test("score just below AUTO_ALLOW yields ALLOW", () => {
    const result = applyThresholds(THRESHOLDS.AUTO_ALLOW - 1, computeChallengeScarcity(2));
    expect(result.recommendation).toBe("ALLOW");
  });

  test("score at ALLOW boundary yields ALLOW", () => {
    const result = applyThresholds(THRESHOLDS.ALLOW, computeChallengeScarcity(2));
    expect(result.recommendation).toBe("ALLOW");
  });

  test("score below WARN yields DENY with 100 confidence", () => {
    const result = applyThresholds(THRESHOLDS.WARN - 1, computeChallengeScarcity(2));
    expect(result.recommendation).toBe("DENY");
    expect(result.minimumPlayerConfidenceRequired).toBe(100);
  });

  test("scarcity raises effective thresholds", () => {
    const plenty = applyThresholds(52, computeChallengeScarcity(2));
    const scarce = applyThresholds(52, computeChallengeScarcity(1));

    expect(plenty.recommendation).toBe("ALLOW");
    expect(scarce.recommendation).toBe("WARN");
    expect(scarce.effectiveThresholds.allow).toBeGreaterThan(
      plenty.effectiveThresholds.allow
    );
  });

  test("scarcity raises minimum confidence in ALLOW zone", () => {
    const plenty = applyThresholds(60, computeChallengeScarcity(2));
    const scarce = applyThresholds(60, computeChallengeScarcity(1));

    expect(scarce.minimumPlayerConfidenceRequired).toBeGreaterThan(
      plenty.minimumPlayerConfidenceRequired
    );
  });
});
