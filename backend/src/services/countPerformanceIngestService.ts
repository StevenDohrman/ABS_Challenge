/**
 * Fetches batter Statcast history at lineup lock and persists wOBA-by-count for RE scaling.
 */

import {
  SavantLineupJob,
  rollupCountPerformance,
  type LineupPlayer,
} from "@abs/data-pipeline";
import { SEASONS } from "../db/constants";
import { findGameLineups } from "../db/lineupRepository";
import {
  findRecentlyRefreshedPerformancePlayerIds,
  upsertPlayerCountPerformance,
} from "../db/countPerformanceRepository";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000;

export async function ingestCountPerformanceForGame(gamePk: number): Promise<void> {
  try {
    const season = SEASONS.CURRENT;
    const lineups = await findGameLineups(gamePk);
    const batterIds = [...new Set(lineups.map((row) => row.playerId))];

    if (batterIds.length === 0) return;

    const recentlyRefreshed = await findRecentlyRefreshedPerformancePlayerIds(
      batterIds,
      season,
      REFRESH_INTERVAL_MS
    );
    const toFetch = batterIds.filter((id) => !recentlyRefreshed.has(id));

    if (toFetch.length === 0) {
      console.log(
        `[countPerformanceIngest] skipping game ${gamePk} — all ${batterIds.length} batters refreshed within 6h`
      );
      return;
    }

    const job = new SavantLineupJob();
    const persistPromises: Promise<void>[] = [];

    job.on("playerHistory", (result) => {
      if (result.playerType !== "batter") return;

      const work = (async () => {
        const buckets = rollupCountPerformance(result.history);
        await upsertPlayerCountPerformance(
          result.playerId,
          season,
          buckets,
          new Date()
        );
      })().catch((err) => {
        console.error(
          `[countPerformanceIngest] failed to persist player ${result.playerId}:`,
          err
        );
      });

      persistPromises.push(work);
    });

    job.on("error", (err) => {
      console.error("[countPerformanceIngest]", err.message);
    });

    const players: LineupPlayer[] = toFetch.map((playerId) => ({
      playerId,
      playerType: "batter",
    }));

    console.log(
      `[countPerformanceIngest] game ${gamePk}: fetching ${players.length}/${batterIds.length} batters (season ${season})`
    );

    await job.run(players, season);
    await Promise.allSettled(persistPromises);
  } catch (err) {
    console.error(`[countPerformanceIngest] failed for game ${gamePk}:`, err);
  }
}
