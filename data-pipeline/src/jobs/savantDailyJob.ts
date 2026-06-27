import { EventEmitter } from "events";
import {
  fetchExpectedStatsCsv,
  fetchPlateDisciplineCsv,
  fetchSprayProfileCsv,
  fetchFielderOaaCsv,
  fetchSprintSpeedCsv,
} from "../sources/savant/savant.client";
import {
  parseExpectedStats,
  mergePlateDiscipline,
  parseSprayProfiles,
  parseFielderOaa,
  parseSprintSpeed,
} from "../sources/savant/savant.parser";
import {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantSprintSpeed,
} from "../sources/savant/savant.types";

/**
 * Type-safe event overloads for SavantDailyJob.
 *
 * The backend registers handlers on these events to cache pregame context
 * before the first pitch of the day. Each pipeline emits independently so
 * the backend can begin caching as soon as any segment completes.
 *
 * Example (backend):
 *   const job = new SavantDailyJob();
 *   job.on('batterStatlines', (s) => cache.set('batters', s));
 *   job.on('sprayProfiles',   (s) => cache.set('spray', s));
 *   job.on('fielderOaa',      (s) => cache.set('oaa', s));
 *   job.on('sprintSpeed',     (s) => cache.set('speed', s));
 *   await job.run(2026);
 */
export interface SavantDailyJob {
  on(
    event: "batterStatlines",
    listener: (statlines: SavantBatterStatline[]) => void
  ): this;
  on(
    event: "sprayProfiles",
    listener: (profiles: SavantBatterSprayProfile[]) => void
  ): this;
  on(
    event: "fielderOaa",
    listener: (oaa: SavantFielderOaa[]) => void
  ): this;
  on(
    event: "sprintSpeed",
    listener: (speeds: SavantSprintSpeed[]) => void
  ): this;
  on(event: "error", listener: (err: Error) => void): this;
}

/**
 * Fetches all Savant pregame context data for a given season.
 *
 * Runs four independent pipelines in parallel:
 *   1. Batter statlines   (expected-statistics + plate-discipline merge)
 *   2. Batter spray profiles
 *   3. Fielder OAA        (all positions)
 *   4. Sprint speed       (all positions)
 *
 * Errors from individual pipelines are emitted on `error` with a
 * descriptive message; remaining pipelines continue unaffected.
 */
export class SavantDailyJob extends EventEmitter {
  async run(season: number): Promise<void> {
    const fetchedAt = new Date().toISOString();

    await Promise.allSettled([
      this.runBatterStatlines(season, fetchedAt),
      this.runSprayProfiles(season, fetchedAt),
      this.runFielderOaa(season, fetchedAt),
      this.runSprintSpeed(season, fetchedAt),
    ]);
  }

  private async runBatterStatlines(
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const [xStatsCsv, disciplineCsv] = await Promise.all([
        fetchExpectedStatsCsv(season),
        fetchPlateDisciplineCsv(season),
      ]);
      const statlines = parseExpectedStats(xStatsCsv, fetchedAt);
      this.emit("batterStatlines", mergePlateDiscipline(statlines, disciplineCsv));
    } catch (err) {
      this.emitError("batter statlines", err);
    }
  }

  private async runSprayProfiles(
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const csv = await fetchSprayProfileCsv(season);
      this.emit("sprayProfiles", parseSprayProfiles(csv, fetchedAt));
    } catch (err) {
      this.emitError("spray profiles", err);
    }
  }

  private async runFielderOaa(
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const csv = await fetchFielderOaaCsv(season);
      this.emit("fielderOaa", parseFielderOaa(csv, fetchedAt));
    } catch (err) {
      this.emitError("fielder OAA", err);
    }
  }

  private async runSprintSpeed(
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const csv = await fetchSprintSpeedCsv(season);
      this.emit("sprintSpeed", parseSprintSpeed(csv, fetchedAt));
    } catch (err) {
      this.emitError("sprint speed", err);
    }
  }

  private emitError(source: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.emit("error", new Error(`SavantDailyJob [${source}]: ${message}`));
  }
}
