import { computeChallengeScarcity } from "../features/challengeScarcity";
import { SCARCITY } from "../constants";

describe("computeChallengeScarcity", () => {
  test("2+ challenges → plenty with no shifts", () => {
    const result = computeChallengeScarcity(2);
    expect(result.scarcityLevel).toBe("plenty");
    expect(result.thresholdShift).toBe(0);
    expect(result.confidenceShift).toBe(0);
  });

  test("1 challenge → scarce with configured shifts", () => {
    const result = computeChallengeScarcity(1);
    expect(result.scarcityLevel).toBe("scarce");
    expect(result.thresholdShift).toBe(SCARCITY.SCARCE_THRESHOLD_SHIFT);
    expect(result.confidenceShift).toBe(SCARCITY.SCARCE_CONFIDENCE_SHIFT);
  });

  test("0 challenges → none with no shifts", () => {
    const result = computeChallengeScarcity(0);
    expect(result.scarcityLevel).toBe("none");
    expect(result.thresholdShift).toBe(0);
    expect(result.confidenceShift).toBe(0);
  });

  test("negative challenges → none", () => {
    const result = computeChallengeScarcity(-1);
    expect(result.scarcityLevel).toBe("none");
  });

  test("with current 2-challenge allotment, 2 remaining is plenty not moderate", () => {
    expect(computeChallengeScarcity(2).scarcityLevel).toBe("plenty");
    expect(computeChallengeScarcity(1).scarcityLevel).toBe("scarce");
  });
});
