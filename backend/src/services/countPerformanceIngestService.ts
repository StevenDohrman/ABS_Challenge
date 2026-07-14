/**
 * Fetches batter Statcast history at lineup lock and persists wOBA-by-count for RE scaling.
 */

import {
  SavantLineupJob,
  rollupCountPerformance,
  type LineupPlayer,
} from "@abs/data-pipeline";
import { INTERVALS, SEASONS } from "../db/constants";
import { findGameLineups } from "../db/lineupRepository";
import {
  findRecentlyRefreshedPerformancePlayerIds,
  bulkUpsertPlayerCountPerformance,
  type PlayerCountPerformanceRow,
} from "../db/countPerformanceRepository";

export async function ingestCountPerformanceForGame(gamePk: number): Promise<void> {
  try {
    const season = SEASONS.CURRENT;
    const lineups = await findGameLineups(gamePk);
    const batterIds = [...new Set(lineups.map((row) => row.playerId))];

    if (batterIds.length === 0) return;

    const recentlyRefreshed = await findRecentlyRefreshedPerformancePlayerIds(
      batterIds,
      season,
      INTERVALS.SIX_HOURS_MS
    );
    const toFetch = batterIds.filter((id) => !recentlyRefreshed.has(id));

    if (toFetch.length === 0) {
      console.log(
        `[countPerformanceIngest] skipping game ${gamePk} — all ${batterIds.length} batters refreshed within 6h`
      );
      return;
    }

    const job = new SavantLineupJob();
    const rows: PlayerCountPerformanceRow[] = [];

    // Collect rollups in memory only — no DB writes inside the event
    // handler. SavantLineupJob fetches players sequentially (batches of 3
    // over HTTP), so `playerHistory` fires many times; writing on each fire
    // would re-introduce uncapped per-player upserts (Phase 8B).
    job.on("playerHistory", (result) => {
      if (result.playerType !== "batter") return;
      rows.push({
        playerId: result.playerId,
        season,
        buckets: rollupCountPerformance(result.history),
        fetchedAt: new Date(),
      });
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
    await bulkUpsertPlayerCountPerformance(rows);
  } catch (err) {
    console.error(`[countPerformanceIngest] failed for game ${gamePk}:`, err);
  }
}
