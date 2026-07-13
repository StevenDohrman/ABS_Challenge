import {
  LEAGUE_COUNT_DELTA,
  resolveCountDelta,
  lookupCountDelta,
} from "../data/countDelta";

describe("resolveCountDelta", () => {
  it("returns fixed league delta when batter context is missing", () => {
    expect(resolveCountDelta(1, 0)).toEqual({
      delta: LEAGUE_COUNT_DELTA["1-0"],
      source: "fixed",
    });
  });

  it("scales delta by batter vs league wOBA at the count", () => {
    const result = resolveCountDelta(3, 0, {
      batterWobaByCount: { "3-0": 0.9 },
      leagueWobaByCount: { "3-0": 0.6 },
    });

    expect(result.source).toBe("batter");
    expect(result.delta).toBeCloseTo(LEAGUE_COUNT_DELTA["3-0"] * 1.5, 6);
  });

  it("returns fixed delta when batter wOBA is missing", () => {
    expect(
      lookupCountDelta(0, 2, {
        batterWobaByCount: {},
        leagueWobaByCount: { "0-2": 0.185 },
      })
    ).toBe(LEAGUE_COUNT_DELTA["0-2"]);
  });

  it("uses compile-time fallback league wOBA when daily rollup omits the count", () => {
    const delta = lookupCountDelta(0, 2, {
      batterWobaByCount: { "0-2": 0.15 },
      leagueWobaByCount: {},
    });

    expect(delta).toBeCloseTo(LEAGUE_COUNT_DELTA["0-2"] * (0.15 / 0.185), 6);
  });
});
