import {
  lookupBaseRE,
  computeChallengeOutcomeExpectancies,
} from "../data/runExpectancy";

const EMPTY = { first: false, second: false, third: false };
const FIRST = { first: true, second: false, third: false };
const SECOND = { first: false, second: true, third: false };
const LOADED = { first: true, second: true, third: true };
const FIRST_SECOND = { first: true, second: true, third: false };

// ---------------------------------------------------------------------------
// lookupBaseRE
// ---------------------------------------------------------------------------

describe("lookupBaseRE", () => {
  test("returns correct RE for bases empty, 0 outs", () => {
    expect(lookupBaseRE(0, EMPTY)).toBeCloseTo(0.544, 2);
  });

  test("returns correct RE for bases loaded, 0 outs", () => {
    expect(lookupBaseRE(0, LOADED)).toBeCloseTo(2.390, 2);
  });

  test("returns correct RE for bases loaded, 2 outs", () => {
    expect(lookupBaseRE(2, LOADED)).toBeCloseTo(0.815, 2);
  });

  test("returns 0 when outs >= 3 (inning over)", () => {
    expect(lookupBaseRE(3, LOADED)).toBe(0);
    expect(lookupBaseRE(4, FIRST)).toBe(0);
  });

  test("RE increases as more runners are on base", () => {
    const re0 = lookupBaseRE(0, EMPTY);
    const re1 = lookupBaseRE(0, FIRST);
    const re2 = lookupBaseRE(0, SECOND);
    const reLoaded = lookupBaseRE(0, LOADED);

    expect(re1).toBeGreaterThan(re0);
    expect(re2).toBeGreaterThan(re1);
    expect(reLoaded).toBeGreaterThan(re2);
  });

  test("RE decreases as outs increase", () => {
    const re0Out = lookupBaseRE(0, FIRST);
    const re1Out = lookupBaseRE(1, FIRST);
    const re2Out = lookupBaseRE(2, FIRST);

    expect(re0Out).toBeGreaterThan(re1Out);
    expect(re1Out).toBeGreaterThan(re2Out);
  });
});

// ---------------------------------------------------------------------------
// computeChallengeOutcomeExpectancies — called strike challenge scenarios
// ---------------------------------------------------------------------------

describe("computeChallengeOutcomeExpectancies", () => {
  describe("success path (call overturned to ball)", () => {
    test("adds a ball when balls < 3 (count continues)", () => {
      // 1-1 count, bases empty, 0 outs
      const { current, ifSucceeds, ifFails } =
        computeChallengeOutcomeExpectancies(0, 1, 1, EMPTY);

      // Success: count goes from 1-1 to 2-1 (more favorable for batter)
      expect(ifSucceeds).toBeGreaterThan(current);

      // Failure: count goes from 1-1 to 1-2 (less favorable for batter)
      expect(ifFails).toBeLessThan(current);
    });

    test("produces a walk when balls = 3 (called strike overturned)", () => {
      // 3-2 count, bases empty, 0 outs → success = walk
      const { ifSucceeds } =
        computeChallengeOutcomeExpectancies(0, 3, 2, EMPTY);

      // A walk with bases empty puts a runner on first
      const expectedAfterWalk = lookupBaseRE(0, FIRST);
      expect(ifSucceeds).toBeCloseTo(expectedAfterWalk, 2);
    });

    test("produces a bases-loaded walk that scores a run", () => {
      // 3-2 count, bases loaded, 0 outs → success = walk + run scores
      const { ifSucceeds } =
        computeChallengeOutcomeExpectancies(0, 3, 2, LOADED);

      // 1 run scored + RE for loaded bases at 0 outs
      const expectedAfterWalk = 1 + lookupBaseRE(0, LOADED);
      expect(ifSucceeds).toBeCloseTo(expectedAfterWalk, 2);
    });
  });

  describe("failure path (call stands as strike)", () => {
    test("adds a strike when strikes < 2 (count continues)", () => {
      // 0-1 count, bases empty, 0 outs → failure = 0-2
      const { ifFails, current } =
        computeChallengeOutcomeExpectancies(0, 0, 1, EMPTY);

      expect(ifFails).toBeLessThan(current);
    });

    test("produces a strikeout when strikes = 2", () => {
      // 0-2 count, bases empty, 0 outs → failure = strikeout (1 out)
      const { ifFails } =
        computeChallengeOutcomeExpectancies(0, 0, 2, EMPTY);

      // Strikeout: outs goes from 0 to 1, bases stay empty
      expect(ifFails).toBeCloseTo(lookupBaseRE(1, EMPTY), 2);
    });

    test("produces 0 when strikeout ends the inning (2 outs already)", () => {
      // 0-2 count, 2 outs → failure = inning over
      const { ifFails } =
        computeChallengeOutcomeExpectancies(2, 0, 2, FIRST_SECOND);

      expect(ifFails).toBe(0);
    });
  });

  describe("EV delta sanity checks", () => {
    test("high-leverage scenario (3-2, loaded, 0 outs) has large reDelta", () => {
      const { ifSucceeds, ifFails } =
        computeChallengeOutcomeExpectancies(0, 3, 2, LOADED);

      const reDelta = ifSucceeds - ifFails;
      // Walk (success): 1 + RE(0, loaded) ≈ 3.39
      // Strikeout (failure): RE(1, loaded) ≈ 1.63
      // Delta ≈ 1.76 — enormous swing
      expect(reDelta).toBeGreaterThan(1.5);
    });

    test("low-leverage scenario (0-0, empty, 2 outs) has small reDelta", () => {
      const { ifSucceeds, ifFails } =
        computeChallengeOutcomeExpectancies(2, 0, 0, EMPTY);

      const reDelta = ifSucceeds - ifFails;
      // Continuation: 0-0→1-0 vs 0-0→0-1, minor count delta difference
      expect(Math.abs(reDelta)).toBeLessThan(0.20);
    });
  });
});
