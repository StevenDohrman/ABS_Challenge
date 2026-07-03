import { computeOffensiveValue } from "../features/offensiveValue";
import { OFFENSIVE } from "../constants";
import { averagePlayer, disciplinedPlayer } from "./fixtures/players";
import { defaultLeague } from "./fixtures/league";

describe("computeOffensiveValue", () => {
  test("null OPS and OBP → 1.0 multiplier", () => {
    const result = computeOffensiveValue(
      { ...averagePlayer, ops: null, obp: null },
      defaultLeague
    );
    expect(result.multiplier).toBe(1.0);
    expect(result.opsWasAvailable).toBe(false);
  });

  test("league-average OPS → 1.0 multiplier", () => {
    const result = computeOffensiveValue(
      { ...averagePlayer, ops: defaultLeague.ops },
      defaultLeague
    );
    expect(result.multiplier).toBeCloseTo(1.0, 2);
    expect(result.opsWasAvailable).toBe(true);
  });

  test("elite OPS → multiplier above 1.0", () => {
    const result = computeOffensiveValue(disciplinedPlayer, defaultLeague);
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.multiplier).toBeLessThanOrEqual(OFFENSIVE.MAX_MULTIPLIER);
  });

  test("low OPS → multiplier below 1.0", () => {
    const result = computeOffensiveValue(
      { ...averagePlayer, ops: 0.550 },
      defaultLeague
    );
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.multiplier).toBeGreaterThanOrEqual(OFFENSIVE.MIN_MULTIPLIER);
  });

  test("uses OBP proxy when OPS is null", () => {
    const result = computeOffensiveValue(
      { ...averagePlayer, ops: null, obp: 0.450 },
      defaultLeague
    );
    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.opsWasAvailable).toBe(false);
  });
});
