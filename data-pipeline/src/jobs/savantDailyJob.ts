import { EventEmitter } from "events";
import {
  fetchExpectedStatsCsv,
  fetchPlateDisciplineCsv,
  fetchSprayProfileCsv,
  fetchFielderOaaCsv,
  fetchSprintSpeedCsv,
  fetchPitchArsenalStatsCsv,
  fetchSeasonPitcherStatcastCsv,
  fetchSeasonBatterStatcastCsv,
} from "../sources/savant/savant.client";
import {
  parseExpectedStats,
  mergePlateDiscipline,
  parseSprayProfiles,
  parseFielderOaa,
  parseSprintSpeed,
  parsePitchArsenalStats,
  aggregatePitchMixBallRates,
} from "../sources/savant/savant.parser";
import {
  computeLeagueAveragesFromCsvs,
  fetchLeagueOps,
  type LeagueAveragesSnapshot,
} from "../sources/savant/leagueAverages";
import {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantSprintSpeed,
  SavantPitcherPitchMix,
} from "../sources/savant/savant.types";

interface DailyCsvBundle {
  expectedStatsCsv: string;
  disciplineCsv: string;
  sprayCsv: string;
  sprintCsv: string;
  fielderOaaCsv: string;
  pitcherArsenalCsv: string;
  pitcherStatcastCsv: string;
  batterStatcastCsv: string;
  leagueOps: number | null;
}

/**
 * Type-safe event overloads for SavantDailyJob.
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
  on(
    event: "leagueAverages",
    listener: (averages: LeagueAveragesSnapshot) => void
  ): this;
  on(
    event: "pitcherPitchMix",
    listener: (mix: SavantPitcherPitchMix[]) => void
  ): this;
  on(event: "error", listener: (err: Error) => void): this;
}

/**
 * Fetches all Savant pregame context data for a given season.
 * CSVs are downloaded once per run and shared across pipelines.
 */
export class SavantDailyJob extends EventEmitter {
  async run(season: number): Promise<void> {
    const fetchedAt = new Date().toISOString();

    let bundle: DailyCsvBundle;
    try {
      bundle = await this.fetchDailyCsvBundle(season);
    } catch (err) {
      this.emitError("daily CSV bundle", err);
      return;
    }

    await Promise.allSettled([
      this.runBatterStatlines(bundle, fetchedAt),
      this.runSprayProfiles(bundle.sprayCsv, fetchedAt),
      this.runFielderOaa(bundle.fielderOaaCsv, fetchedAt),
      this.runSprintSpeed(bundle.sprintCsv, fetchedAt),
      this.runPitcherPitchMix(bundle, season, fetchedAt),
      this.runLeagueAverages(bundle, season, fetchedAt),
    ]);
  }

  private async fetchDailyCsvBundle(season: number): Promise<DailyCsvBundle> {
    const [
      expectedStatsCsv,
      disciplineCsv,
      sprayCsv,
      sprintCsv,
      fielderOaaCsv,
      pitcherArsenalCsv,
      pitcherStatcastCsv,
      batterStatcastCsv,
      leagueOps,
    ] = await Promise.all([
      fetchExpectedStatsCsv(season),
      fetchPlateDisciplineCsv(season),
      fetchSprayProfileCsv(season),
      fetchSprintSpeedCsv(season),
      fetchFielderOaaCsv(season),
      fetchPitchArsenalStatsCsv(season),
      fetchSeasonPitcherStatcastCsv(season),
      fetchSeasonBatterStatcastCsv(season).catch((err) => {
        console.error(
          `[SavantDailyJob] batter Statcast CSV failed (count wOBA skipped):`,
          err instanceof Error ? err.message : err
        );
        return "";
      }),
      fetchLeagueOps(season),
    ]);

    return {
      expectedStatsCsv,
      disciplineCsv,
      sprayCsv,
      sprintCsv,
      fielderOaaCsv,
      pitcherArsenalCsv,
      pitcherStatcastCsv,
      batterStatcastCsv,
      leagueOps,
    };
  }

  private async runBatterStatlines(
    bundle: DailyCsvBundle,
    fetchedAt: string
  ): Promise<void> {
    try {
      const statlines = parseExpectedStats(bundle.expectedStatsCsv, fetchedAt);
      this.emit(
        "batterStatlines",
        mergePlateDiscipline(statlines, bundle.disciplineCsv)
      );
    } catch (err) {
      this.emitError("batter statlines", err);
    }
  }

  private async runLeagueAverages(
    bundle: DailyCsvBundle,
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      this.emit(
        "leagueAverages",
        computeLeagueAveragesFromCsvs(
          bundle.disciplineCsv,
          bundle.expectedStatsCsv,
          season,
          bundle.leagueOps,
          bundle.sprayCsv,
          bundle.sprintCsv,
          fetchedAt,
          bundle.batterStatcastCsv
        )
      );
    } catch (err) {
      this.emitError("league averages", err);
    }
  }

  private async runSprayProfiles(
    csv: string,
    fetchedAt: string
  ): Promise<void> {
    try {
      this.emit("sprayProfiles", parseSprayProfiles(csv, fetchedAt));
    } catch (err) {
      this.emitError("spray profiles", err);
    }
  }

  private async runFielderOaa(
    csv: string,
    fetchedAt: string
  ): Promise<void> {
    try {
      this.emit("fielderOaa", parseFielderOaa(csv, fetchedAt));
    } catch (err) {
      this.emitError("fielder OAA", err);
    }
  }

  private async runSprintSpeed(
    csv: string,
    fetchedAt: string
  ): Promise<void> {
    try {
      this.emit("sprintSpeed", parseSprintSpeed(csv, fetchedAt));
    } catch (err) {
      this.emitError("sprint speed", err);
    }
  }

  private async runPitcherPitchMix(
    bundle: DailyCsvBundle,
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const ballRates = aggregatePitchMixBallRates(bundle.pitcherStatcastCsv);
      this.emit(
        "pitcherPitchMix",
        parsePitchArsenalStats(
          bundle.pitcherArsenalCsv,
          ballRates,
          season,
          fetchedAt
        )
      );
    } catch (err) {
      this.emitError("pitcher pitch mix", err);
    }
  }

  private emitError(source: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.emit("error", new Error(`SavantDailyJob [${source}]: ${message}`));
  }
}
