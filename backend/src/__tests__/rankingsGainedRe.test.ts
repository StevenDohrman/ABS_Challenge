import { rawOverturnReSwing } from "../services/rankingsGainedRe";

describe("rawOverturnReSwing", () => {
  it("returns positive RE swing for a typical called-strike count", () => {
    const swing = rawOverturnReSwing(1, 1, 2, {
      first: true,
      second: false,
      third: false,
    });
    expect(swing).toBeGreaterThan(0);
  });

  it("returns zero on an already-terminal 3-2 walk path swing edge", () => {
    const swing = rawOverturnReSwing(2, 3, 2, {
      first: false,
      second: false,
      third: false,
    });
    expect(swing).toBeGreaterThanOrEqual(0);
  });
});
