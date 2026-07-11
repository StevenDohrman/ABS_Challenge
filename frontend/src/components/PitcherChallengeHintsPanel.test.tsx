import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PitcherChallengeHintsPanel } from "../components/PitcherChallengeHintsPanel";
import type { PitcherChallengeHints } from "../api/types";

const mockHints: PitcherChallengeHints = {
  pitcherId: 592332,
  pitcherName: "Kevin Gausman",
  season: 2026,
  summary:
    "If you recognize one of these pitches on a close call, consider challenging more often.",
  pitches: [
    {
      pitchType: "SL",
      pitchTypeName: "Slider",
      ballRate: 0.47,
      usageRate: 0.24,
      pitchCount: 420,
      highlight: true,
    },
    {
      pitchType: "FF",
      pitchTypeName: "4-Seam Fastball",
      ballRate: 0.35,
      usageRate: 0.51,
      pitchCount: 899,
      highlight: false,
    },
  ],
};

describe("PitcherChallengeHintsPanel", () => {
  it("renders highlighted pitches and summary copy", () => {
    const html = renderToStaticMarkup(
      <PitcherChallengeHintsPanel hints={mockHints} />
    );

    expect(html).toContain("Pitcher challenge hints");
    expect(html).toContain("Kevin Gausman");
    expect(html).toContain("Slider");
    expect(html).toContain("47%");
    expect(html).toContain("consider challenging more often");
    expect(html).not.toContain("4-Seam Fastball");
  });

  it("renders nothing when no pitches are highlighted", () => {
    const html = renderToStaticMarkup(
      <PitcherChallengeHintsPanel
        hints={{
          ...mockHints,
          pitches: mockHints.pitches.map((pitch) => ({ ...pitch, highlight: false })),
        }}
      />
    );

    expect(html).toBe("");
  });
});
