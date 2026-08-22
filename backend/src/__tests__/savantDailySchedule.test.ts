import {
  formatDurationMs,
  msUntilNextSavantDaily,
} from "../services/savantDailySchedule";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("msUntilNextSavantDaily", () => {
  const now = new Date("2026-08-22T18:00:00Z");

  it("runs immediately when there is no prior persist", () => {
    expect(msUntilNextSavantDaily(null, now, DAY_MS)).toBe(0);
  });

  it("runs immediately when the last persist is 24 hours old or older", () => {
    expect(
      msUntilNextSavantDaily(new Date("2026-08-21T18:00:00Z"), now, DAY_MS)
    ).toBe(0);
    expect(
      msUntilNextSavantDaily(new Date("2026-08-20T18:00:00Z"), now, DAY_MS)
    ).toBe(0);
  });

  it("returns the remaining window when data is still fresh", () => {
    const lastRun = new Date("2026-08-21T19:00:00Z"); // 23h ago
    expect(msUntilNextSavantDaily(lastRun, now, DAY_MS)).toBe(60 * 60 * 1_000);
  });
});

describe("formatDurationMs", () => {
  it("formats hours and minutes", () => {
    expect(formatDurationMs(90 * 60 * 1_000)).toBe("1h 30m");
    expect(formatDurationMs(45 * 60 * 1_000)).toBe("45m");
    expect(formatDurationMs(2 * 60 * 60 * 1_000)).toBe("2h");
  });
});
