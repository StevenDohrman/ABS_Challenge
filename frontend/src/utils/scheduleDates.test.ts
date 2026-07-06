import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCHEDULE_DAY_COUNT,
  buildScheduleDateOptions,
  buildScheduleDateOptionsOldestFirst,
  daysAgoForDate,
  goToNewerDay,
  goToOlderDay,
  isDateInScheduleWindow,
  mlbDateDaysAgo,
  mlbToday,
} from "./scheduleDates";

describe("mlbToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T18:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses ET offset for the official date", () => {
    expect(mlbToday()).toBe("2026-07-05");
  });
});

describe("mlbDateDaysAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today at 0 days ago", () => {
    expect(mlbDateDaysAgo(0)).toBe("2026-07-05");
  });

  it("steps back one day at a time", () => {
    expect(mlbDateDaysAgo(1)).toBe("2026-07-04");
    expect(mlbDateDaysAgo(6)).toBe("2026-06-29");
  });
});

describe("buildScheduleDateOptions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a 7-day window starting today", () => {
    const options = buildScheduleDateOptions();
    expect(options).toHaveLength(SCHEDULE_DAY_COUNT);
    expect(options[0]).toMatchObject({ daysAgo: 0, date: "2026-07-05", shortLabel: "Today" });
    expect(options[1].shortLabel).toBe("Yesterday");
  });

  it("reverses to oldest-first", () => {
    const options = buildScheduleDateOptionsOldestFirst();
    expect(options[0].daysAgo).toBe(SCHEDULE_DAY_COUNT - 1);
    expect(options.at(-1)?.daysAgo).toBe(0);
  });
});

describe("daysAgoForDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps known dates to days ago", () => {
    expect(daysAgoForDate("2026-07-04")).toBe(1);
  });

  it("defaults unknown dates to 0", () => {
    expect(daysAgoForDate("2020-01-01")).toBe(0);
  });
});

describe("isDateInScheduleWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts dates in the 7-day window", () => {
    expect(isDateInScheduleWindow("2026-07-05")).toBe(true);
    expect(isDateInScheduleWindow("2026-06-29")).toBe(true);
  });

  it("rejects dates outside the window", () => {
    expect(isDateInScheduleWindow("2026-06-28")).toBe(false);
  });
});

describe("day navigation", () => {
  it("wraps when stepping older from oldest", () => {
    expect(goToOlderDay(SCHEDULE_DAY_COUNT - 1)).toBe(0);
  });

  it("wraps when stepping newer from today", () => {
    expect(goToNewerDay(0)).toBe(SCHEDULE_DAY_COUNT - 1);
  });

  it("steps within the window", () => {
    expect(goToOlderDay(0)).toBe(1);
    expect(goToNewerDay(2)).toBe(1);
  });
});
