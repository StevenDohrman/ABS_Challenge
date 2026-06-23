import {
  ALL_COUNT_STATES,
  GAME_RULES,
  CALL_CODES,
  STAT_CONVERSION,
  SEASONS,
} from "../db/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ALL_COUNT_STATES
// ─────────────────────────────────────────────────────────────────────────────

describe("ALL_COUNT_STATES", () => {
  it("has exactly 12 entries — one per valid (balls, strikes) pair", () => {
    expect(ALL_COUNT_STATES).toHaveLength(12);
  });

  it("all ball counts are within 0–3", () => {
    for (const [balls] of ALL_COUNT_STATES) {
      expect(balls).toBeGreaterThanOrEqual(0);
      expect(balls).toBeLessThanOrEqual(3);
    }
  });

  it("all strike counts are within 0–2 (3 strikes is a terminal strikeout, not a count state)", () => {
    for (const [, strikes] of ALL_COUNT_STATES) {
      expect(strikes).toBeGreaterThanOrEqual(0);
      expect(strikes).toBeLessThanOrEqual(2);
    }
  });

  it("contains no duplicate count states", () => {
    const keys = ALL_COUNT_STATES.map(([b, s]) => `${b}-${s}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(ALL_COUNT_STATES.length);
  });

  it("includes the first pitch (0-0)", () => {
    const hasLeadOff = ALL_COUNT_STATES.some(([b, s]) => b === 0 && s === 0);
    expect(hasLeadOff).toBe(true);
  });

  it("includes the full count (3-2) — the most consequential count state", () => {
    const hasFullCount = ALL_COUNT_STATES.some(([b, s]) => b === 3 && s === 2);
    expect(hasFullCount).toBe(true);
  });

  it("contains all expected count pairs", () => {
    const expected: Array<readonly [number, number]> = [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
      [3, 0], [3, 1], [3, 2],
    ];

    for (const [eb, es] of expected) {
      const found = ALL_COUNT_STATES.some(([b, s]) => b === eb && s === es);
      expect(found).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GAME_RULES
// ─────────────────────────────────────────────────────────────────────────────

describe("GAME_RULES", () => {
  it("DEFAULT_CHALLENGES_PER_TEAM is a positive integer", () => {
    expect(GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM).toBeGreaterThan(0);
    expect(Number.isInteger(GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM)).toBe(true);
  });

  it("ZERO_CHALLENGES_REMAINING is exactly 0", () => {
    expect(GAME_RULES.ZERO_CHALLENGES_REMAINING).toBe(0);
  });

  it("ZERO_CHALLENGES_REMAINING is less than DEFAULT_CHALLENGES_PER_TEAM", () => {
    expect(GAME_RULES.ZERO_CHALLENGES_REMAINING).toBeLessThan(
      GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CALL_CODES
// ─────────────────────────────────────────────────────────────────────────────

describe("CALL_CODES", () => {
  it("CALLED_STRIKE is the MLB API code for a called strike", () => {
    // "C" is the MLB Stats API event code for a called strike — this should
    // never change without a corresponding update to the MLB API contract.
    expect(CALL_CODES.CALLED_STRIKE).toBe("C");
  });

  it("BALL is the MLB API code for a ball", () => {
    expect(CALL_CODES.BALL).toBe("B");
  });

  it("CALLED_STRIKE and BALL are different codes", () => {
    expect(CALL_CODES.CALLED_STRIKE).not.toBe(CALL_CODES.BALL);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STAT_CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

describe("STAT_CONVERSION", () => {
  it("PERCENT_TO_RATE_DIVISOR is 100 so that dividing a percentage yields a rate", () => {
    // e.g. 22.5% / 100 = 0.225 rate
    expect(STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR).toBe(100);
  });

  it("converts a representative Savant percentage to the correct rate", () => {
    const savantKPercent = 22.5;
    const expectedRate = 0.225;
    expect(savantKPercent / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR).toBeCloseTo(
      expectedRate,
      4
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEASONS
// ─────────────────────────────────────────────────────────────────────────────

describe("SEASONS", () => {
  it("CURRENT is a four-digit year", () => {
    expect(SEASONS.CURRENT).toBeGreaterThanOrEqual(2020);
    expect(SEASONS.CURRENT).toBeLessThanOrEqual(2100);
    expect(Number.isInteger(SEASONS.CURRENT)).toBe(true);
  });
});
