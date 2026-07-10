import { describe, it, expect } from "vitest";
import { validateRunners, clampCount } from "./runners";

describe("validateRunners", () => {
  it("warns on duplicate runner ids", () => {
    const warnings = validateRunners({ first: 1, second: 1 });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("passes for distinct runners", () => {
    expect(validateRunners({ first: 1, third: 2 })).toEqual([]);
  });
});

describe("clampCount", () => {
  it("clamps to range", () => {
    expect(clampCount(5, 3)).toBe(3);
    expect(clampCount(-1, 3)).toBe(0);
  });
});
