import { describe, expect, it } from "vitest";
import {
  formatHalfInning,
  formatInningShort,
  formatOrdinal,
  inningHalfArrow,
  ordinalSuffix,
  teamAbbrev,
} from "./baseballDisplay";

describe("ordinalSuffix", () => {
  it("handles standard ordinals", () => {
    expect(ordinalSuffix(1)).toBe("st");
    expect(ordinalSuffix(2)).toBe("nd");
    expect(ordinalSuffix(3)).toBe("rd");
    expect(ordinalSuffix(4)).toBe("th");
  });

  it("handles teens correctly", () => {
    expect(ordinalSuffix(11)).toBe("th");
    expect(ordinalSuffix(12)).toBe("th");
    expect(ordinalSuffix(21)).toBe("st");
  });
});

describe("formatOrdinal", () => {
  it("combines number and suffix", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(9)).toBe("9th");
  });
});

describe("inningHalfArrow", () => {
  it("maps Top and Bot", () => {
    expect(inningHalfArrow("Top")).toBe("▲");
    expect(inningHalfArrow("Bot")).toBe("▼");
  });

  it("returns empty in strict mode for unknown halves", () => {
    expect(inningHalfArrow("Mid", true)).toBe("");
  });

  it("defaults non-Top to down arrow", () => {
    expect(inningHalfArrow("Bot")).toBe("▼");
    expect(inningHalfArrow(null)).toBe("");
  });
});

describe("formatHalfInning", () => {
  it("formats arrow and ordinal inning", () => {
    expect(formatHalfInning("Top", 3)).toBe("▲ 3rd");
    expect(formatHalfInning("Bot", 9)).toBe("▼ 9th");
  });
});

describe("formatInningShort", () => {
  it("formats arrow and inning number without ordinal", () => {
    expect(formatInningShort("Top", 5)).toBe("▲\u00a05");
  });

  it("returns empty when inning is null", () => {
    expect(formatInningShort("Top", null)).toBe("");
  });
});

describe("teamAbbrev", () => {
  it("uses provided abbrev when present", () => {
    expect(teamAbbrev("NYY", "New York Yankees")).toBe("NYY");
  });

  it("falls back to first three letters of team name", () => {
    expect(teamAbbrev("", "Boston Red Sox")).toBe("BOS");
  });
});
