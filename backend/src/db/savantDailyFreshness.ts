import { prisma } from "./prisma";

/**
 * Last successful Savant daily persist for a season.
 *
 * Uses `league_averages_snapshots.updatedAt` only — that table is written
 * solely by SavantDailyJob (last step). Other daily tables are also touched
 * by live ingest (e.g. batting-hand patches on player_stat_snapshots), so
 * MAX(updatedAt) across them would keep looking fresh and skip forever.
 */
export async function findLastSavantDailyRunAt(
  season: number
): Promise<Date | null> {
  const row = await prisma.leagueAveragesSnapshot.aggregate({
    where: { season },
    _max: { updatedAt: true },
  });
  return row._max.updatedAt;
}
