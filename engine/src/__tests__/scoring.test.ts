import { normalizeScore } from "../decision/scoring";
import { SCORING } from "../constants";

describe("normalizeScore", () => {
  test("break-even EV maps to midpoint score", () => {
    expect(normalizeScore(SCORING.BREAK_EVEN_EV)).toBe(SCORING.MIDPOINT);
  });

  test("break-even plus scale EV maps to 100", () => {
    expect(normalizeScore(SCORING.BREAK_EVEN_EV + SCORING.SCALE_EV)).toBe(100);
  });

  test("zero EV maps below midpoint", () => {
    expect(normalizeScore(0)).toBeLessThan(SCORING.MIDPOINT);
  });

  test("clamps to 0–100", () => {
    expect(normalizeScore(-1)).toBe(0);
    expect(normalizeScore(10)).toBe(100);
  });

  test("returns an integer", () => {
    expect(Number.isInteger(normalizeScore(0.05))).toBe(true);
  });
});
