import { describe, expect, it } from "vitest";
import {
  formatRate,
  formatRe,
  formatSignedDecimal,
  formatTimestamp,
} from "./format";

describe("formatRe", () => {
  it("formats positive values with sign and RE suffix", () => {
    expect(formatRe(1.234)).toBe("+1.23 RE");
  });

  it("formats negative values without extra sign", () => {
    expect(formatRe(-0.5)).toBe("-0.50 RE");
  });

  it("formats zero with plus sign", () => {
    expect(formatRe(0)).toBe("+0.00 RE");
  });
});

describe("formatSignedDecimal", () => {
  it("formats without RE suffix", () => {
    expect(formatSignedDecimal(2.5)).toBe("+2.50");
    expect(formatSignedDecimal(-1)).toBe("-1.00");
  });
});

describe("formatRate", () => {
  it("returns em dash for null", () => {
    expect(formatRate(null)).toBe("—");
  });

  it("rounds to whole percent", () => {
    expect(formatRate(0.456)).toBe("46%");
    expect(formatRate(1)).toBe("100%");
  });
});

describe("formatTimestamp", () => {
  it("returns a non-empty time string", () => {
    const result = formatTimestamp(new Date("2026-07-05T20:30:45Z"));
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/\d/);
  });
});
