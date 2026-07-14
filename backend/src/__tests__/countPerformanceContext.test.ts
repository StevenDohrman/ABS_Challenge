import { buildBatterWobaByCount } from "../services/countPerformanceContext";
import { MIN_COUNT_PA } from "@abs/data-pipeline";

describe("buildBatterWobaByCount", () => {
  it("returns null when buckets are missing or unusable", () => {
    expect(buildBatterWobaByCount(null)).toBeNull();
    expect(
      buildBatterWobaByCount({
        "0-0": { paCount: 5, woba: 0.4, xwoba: null },
      })
    ).toBeNull();
  });

  it("includes counts with sufficient sample or xwOBA blend", () => {
    const map = buildBatterWobaByCount({
      "3-0": { paCount: MIN_COUNT_PA, woba: 0.75, xwoba: 0.7 },
      "0-2": { paCount: 10, woba: 0.12, xwoba: 0.18 },
    });

    expect(map).not.toBeNull();
    expect(map!["3-0"]).toBe(0.75);
    expect(map!["0-2"]).toBeCloseTo(0.12 * (10 / MIN_COUNT_PA) + 0.18 * (1 - 10 / MIN_COUNT_PA), 6);
  });
});
