import type { PitcherPitchMix } from "@prisma/client";
import {
  buildPitcherChallengeHintsFromRows,
  filterPitchMixRows,
  formatPitchTypeName,
  pickHighlightedPitchTypes,
} from "../services/pitcherChallengeHintsService";

function makeRow(
  overrides: Partial<PitcherPitchMix> & Pick<PitcherPitchMix, "pitchType" | "ballRate" | "usageRate" | "pitchCount">
): PitcherPitchMix {
  return {
    id: 1,
    pitcherId: 592332,
    pitcherName: "Kevin Gausman",
    season: 2026,
    pitchTypeName: overrides.pitchType,
    strikeRate: 0.5,
    fetchedAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

describe("filterPitchMixRows", () => {
  it("requires minimum pitch count and usage rate", () => {
    const rows = [
      makeRow({ pitchType: "FF", ballRate: 0.45, usageRate: 0.5, pitchCount: 899 }),
      makeRow({ pitchType: "CH", ballRate: 0.5, usageRate: 0.04, pitchCount: 40 }),
      makeRow({ pitchType: "SL", ballRate: 0.42, usageRate: 0.2, pitchCount: 20 }),
    ];

    expect(filterPitchMixRows(rows).map((row) => row.pitchType)).toEqual(["FF"]);
  });
});

describe("pickHighlightedPitchTypes", () => {
  it("highlights top ball-rate pitches above 40% or in the top quartile", () => {
    const highlighted = pickHighlightedPitchTypes([
      { pitchType: "SL", ballRate: 0.48 },
      { pitchType: "CH", ballRate: 0.44 },
      { pitchType: "FF", ballRate: 0.36 },
      { pitchType: "CU", ballRate: 0.31 },
    ]);

    expect([...highlighted]).toEqual(expect.arrayContaining(["SL", "CH"]));
    expect(highlighted.has("FF")).toBe(false);
  });
});

describe("formatPitchTypeName", () => {
  it("prefers Savant names and falls back to friendly codes", () => {
    expect(formatPitchTypeName("SL", "Slider")).toBe("Slider");
    expect(formatPitchTypeName("SL")).toBe("Slider");
    expect(formatPitchTypeName("ZZ")).toBe("ZZ");
  });
});

describe("buildPitcherChallengeHintsFromRows", () => {
  it("returns null when no pitches pass the usage/count filter", () => {
    const hints = buildPitcherChallengeHintsFromRows(592332, 2026, [
      makeRow({ pitchType: "FF", ballRate: 0.3, usageRate: 0.04, pitchCount: 100 }),
      makeRow({ pitchType: "SL", ballRate: 0.5, usageRate: 0.2, pitchCount: 20 }),
    ]);
    expect(hints).toBeNull();
  });

  it("builds highlighted pitch rows sorted by ball rate", () => {
    const hints = buildPitcherChallengeHintsFromRows(
      592332,
      2026,
      [
        makeRow({ pitchType: "FF", pitchTypeName: "4-Seam Fastball", ballRate: 0.41, usageRate: 0.5, pitchCount: 100 }),
        makeRow({ pitchType: "SL", pitchTypeName: "Slider", ballRate: 0.47, usageRate: 0.2, pitchCount: 80 }),
      ],
      "Kevin Gausman"
    );

    expect(hints?.pitcherName).toBe("Kevin Gausman");
    expect(hints?.pitches[0].pitchType).toBe("SL");
    expect(hints?.pitches.filter((pitch) => pitch.highlight).length).toBeGreaterThan(0);
    expect(hints?.summary).toMatch(/recognize one of these pitches/i);
  });
});
