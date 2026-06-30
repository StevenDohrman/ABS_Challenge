import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { recordPlayerName } from "./playerNameRepository";
import type { SavantBatterStatline } from "@abs/data-pipeline";
import type { PlayerStatSnapshot } from "@prisma/client";

export type { PlayerStatSnapshot };

// ─────────────────────────────────────────────────────────────────────────────
// player_stat_snapshots
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a single batter's Savant stat snapshot.
 * Called for every row emitted by SavantDailyJob's `batterStatlines` event.
 *
 * Plate discipline percentages (kPercent, bbPercent, chasePercent, whiffPercent)
 * are stored exactly as Savant provides them — as whole percentages (0–100).
 * The challenge service divides by STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR
 * before passing them to the engine.
 */
export async function upsertBatterStatline(
  statline: SavantBatterStatline
): Promise<PlayerStatSnapshot> {
  const sharedFields = {
    playerName: statline.playerName,
    pa: statline.pa,
    ba: statline.ba,
    slg: statline.slg,
    woba: statline.woba,
    kPercent: statline.kPercent,
    bbPercent: statline.bbPercent,
    xba: statline.xba,
    xslg: statline.xslg,
    xwoba: statline.xwoba,
    hardHitPercent: statline.hardHitPercent,
    barrelPercent: statline.barrelPercent,
    chasePercent: statline.chasePercent,
    whiffPercent: statline.whiffPercent,
    zonePercent: statline.zonePercent,
    fetchedAt: new Date(statline.fetchedAt),
  };

  return prisma.playerStatSnapshot.upsert({
    where: {
      playerId_season: {
        playerId: statline.playerId,
        season: statline.season,
      },
    },
    update: sharedFields,
    create: {
      playerId: statline.playerId,
      season: statline.season,
      ...sharedFields,
    },
  }).then(async (row) => {
    await recordPlayerName(row.playerId, row.playerName);
    return row;
  });
}

/**
 * Bulk upsert an entire batch of batter statlines.
 *
 * Upserts run with bounded concurrency (DB_LIMITS.WRITE_CONCURRENCY) so the
 * batch — typically a few hundred rows — cannot exhaust the connection pool.
 * Failures are logged individually so one bad row does not abort the batch.
 */
export async function upsertBatterStatlines(
  statlines: SavantBatterStatline[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    statlines,
    DB_LIMITS.WRITE_CONCURRENCY,
    (s) => upsertBatterStatline(s)
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[playerRepository] ${failures.length} of ${statlines.length} batter statline upserts failed`,
      failures.map((f) => (f as PromiseRejectedResult).reason)
    );
  }
}

/**
 * Fetch the most recent stat snapshot for a player in a given season.
 * Returns null when no data has been ingested for this player yet.
 */
export async function findPlayerStatSnapshot(
  playerId: number,
  season: number
): Promise<PlayerStatSnapshot | null> {
  return prisma.playerStatSnapshot.findUnique({
    where: {
      playerId_season: { playerId, season },
    },
  });
}

export async function findPlayerStatSnapshotBatch(
  playerIds: number[],
  season: number
): Promise<PlayerStatSnapshot[]> {
  if (playerIds.length === 0) return [];

  return prisma.playerStatSnapshot.findMany({
    where: { season, playerId: { in: playerIds } },
  });
}
