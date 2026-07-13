import type { SavantPlayerPitchHistory } from "../savant.types";
import {
  MIN_COUNT_PA,
  MIN_COUNT_PA_BLEND,
  effectiveCountWoba,
  rollupCountPerformance,
  toLeagueCountWoba,
} from "../countPerformance";

function terminalPitch(
  overrides: Partial<SavantPlayerPitchHistory> & Pick<SavantPlayerPitchHistory, "balls" | "strikes">
): SavantPlayerPitchHistory {
  return {
    gamePk: 1,
    gameDate: "2026-06-01",
    season: 2026,
    batterId: 682998,
    pitcherId: 656731,
    atBatNumber: 1,
    pitchNumber: 1,
    pitchType: "FF",
    releaseSpeed: 95,
    outsWhenUp: 0,
    inning: 1,
    stand: "R",
    pThrows: "R",
    type: "X",
    description: "field_out",
    events: "field_out",
    plateX: 0,
    plateZ: 2.5,
    szTop: 3.5,
    szBot: 1.6,
    zone: 5,
    wobaValue: 0,
    wobaDenom: 1,
    estimatedWoba: 0.25,
    raw: {},
    fetchedAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("rollupCountPerformance", () => {
  it("groups terminal PAs by count and computes wOBA", () => {
    const history = [
      terminalPitch({ balls: 0, strikes: 0, wobaValue: 0.5, wobaDenom: 1 }),
      terminalPitch({ balls: 0, strikes: 0, wobaValue: 0.7, wobaDenom: 1 }),
      terminalPitch({ balls: 0, strikes: 2, wobaValue: 0, wobaDenom: 1 }),
    ];

    const map = rollupCountPerformance(history);

    expect(map["0-0"]).toEqual({
      paCount: 2,
      woba: 0.6,
      xwoba: 0.25,
    });
    expect(map["0-2"]).toEqual({
      paCount: 1,
      woba: 0,
      xwoba: 0.25,
    });
  });

  it("ignores non-terminal pitches", () => {
    const history = [
      terminalPitch({ balls: 1, strikes: 0, events: null, wobaValue: 0.9, wobaDenom: 1 }),
      terminalPitch({ balls: 1, strikes: 0, wobaValue: 0.1, wobaDenom: 1 }),
    ];

    const map = rollupCountPerformance(history);
    expect(map["1-0"]?.paCount).toBe(1);
  });
});

describe("toLeagueCountWoba", () => {
  it("includes only buckets meeting the minimum PA threshold", () => {
    const map = rollupCountPerformance(
      Array.from({ length: MIN_COUNT_PA }, (_, index) =>
        terminalPitch({
          balls: 3,
          strikes: 0,
          wobaValue: 0.8,
          wobaDenom: 1,
          atBatNumber: index + 1,
        })
      )
    );

    const league = toLeagueCountWoba(map);
    expect(league["3-0"]).toBeCloseTo(0.8, 4);
    expect(league["0-0"]).toBeUndefined();
  });
});

describe("effectiveCountWoba", () => {
  it("returns full wOBA when sample is large enough", () => {
    expect(
      effectiveCountWoba({
        paCount: MIN_COUNT_PA,
        woba: 0.42,
        xwoba: 0.38,
      })
    ).toBe(0.42);
  });

  it("blends wOBA with xwOBA for thin samples", () => {
    const paCount = MIN_COUNT_PA_BLEND;
    const weight = paCount / MIN_COUNT_PA;
    const expected = 0.3 * weight + 0.5 * (1 - weight);

    expect(
      effectiveCountWoba({
        paCount,
        woba: 0.3,
        xwoba: 0.5,
      })
    ).toBeCloseTo(expected, 6);
  });

  it("returns null when sample is too thin and xwOBA is missing", () => {
    expect(
      effectiveCountWoba({
        paCount: MIN_COUNT_PA_BLEND - 1,
        woba: 0.3,
        xwoba: null,
      })
    ).toBeNull();
  });
});
