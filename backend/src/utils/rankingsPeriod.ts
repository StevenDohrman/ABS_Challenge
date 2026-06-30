import {
  getDataRetentionDays,
  retentionWindowStart,
} from "../db/constants";
import { formatRollingWindowLabel, mlbToday } from "./mlbDates";

export type RankingsPeriod = "week" | "season";

export interface ResolvedRankingsPeriod {
  period: RankingsPeriod;
  periodStart: string;
  periodEnd: string;
  /** Matches DATA_RETENTION_DAYS — days in the rolling window (week mode only). */
  windowDays: number;
  label: string;
  trackingStartDate: string;
}

/** First date we track for season-to-date rankings (program start). */
export function getTrackingStartDate(): string {
  return process.env["TRACKING_START_DATE"] ?? "2026-03-27";
}

/**
 * Resolve rankings date range.
 *
 * `week` — rolling last N days including today (N = DATA_RETENTION_DAYS).
 *          Aligns with the schedule slider and DB retention window.
 * `season` — TRACKING_START_DATE through today (cumulative; DB may only
 *            retain the last N days unless retention is raised for production).
 */
export function resolveRankingsPeriod(
  periodParam: unknown,
  today: string = mlbToday(),
  windowDays: number = getDataRetentionDays()
): ResolvedRankingsPeriod {
  const trackingStartDate = getTrackingStartDate();
  const period: RankingsPeriod =
    periodParam === "season" ? "season" : "week";

  if (period === "season") {
    return {
      period,
      periodStart: trackingStartDate,
      periodEnd: today,
      windowDays,
      label: "Season to date",
      trackingStartDate,
    };
  }

  const periodStart = retentionWindowStart(today, windowDays);
  const clampedStart =
    periodStart < trackingStartDate ? trackingStartDate : periodStart;

  return {
    period: "week",
    periodStart: clampedStart,
    periodEnd: today,
    windowDays,
    label: formatRollingWindowLabel(clampedStart, today, windowDays),
    trackingStartDate,
  };
}
