import { deriveObpOpsFromSavant } from "../utils/savantStats";

describe("deriveObpOpsFromSavant", () => {
  it("derives OBP and OPS from BA, SLG, and walk rate", () => {
    const { obp, ops } = deriveObpOpsFromSavant(0.28, 0.45, 0.32, 9.5);
    expect(obp).toBeCloseTo(0.375, 3);
    expect(ops).toBeCloseTo(0.825, 3);
  });

  it("falls back to wOBA when BA or walk rate is missing", () => {
    const { obp, ops } = deriveObpOpsFromSavant(null, 0.42, 0.33, null);
    expect(obp).toBeCloseTo(0.3036, 3);
    expect(ops).toBeCloseTo(0.7236, 3);
  });
});
