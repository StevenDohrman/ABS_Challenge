import {
  getTrackingStartDate,
  resolveRankingsPeriod,
} from "../utils/rankingsPeriod";

describe("resolveRankingsPeriod", () => {
  const today = "2026-06-29";

  it("returns season range from tracking start through today", () => {
    const period = resolveRankingsPeriod("season", today);
    expect(period.period).toBe("season");
    expect(period.periodStart).toBe(getTrackingStartDate());
    expect(period.periodEnd).toBe(today);
    expect(period.windowDays).toBe(7);
  });

  it("returns rolling last 7 days including today", () => {
    const period = resolveRankingsPeriod("week", today, 7);
    expect(period.period).toBe("week");
    expect(period.periodStart).toBe("2026-06-23");
    expect(period.periodEnd).toBe(today);
    expect(period.label).toContain("Last 7 days");
  });

  it("respects custom retention window length", () => {
    const period = resolveRankingsPeriod("week", today, 14);
    expect(period.periodStart).toBe("2026-06-16");
    expect(period.windowDays).toBe(14);
  });
});
