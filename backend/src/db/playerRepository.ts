import { prisma } from "./prisma";
import { recordPlayerName, recordPlayerNames } from "./playerNameRepository";
import { bulkUpsert } from "./bulkUpsert";
import type { SavantBatterStatline } from "@abs/data-pipeline";
import type { PlayerStatSnapshot } from "@prisma/client";
import { deriveObpOpsFromSavant } from "../utils/savantStats";

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
  const { obp, ops } = deriveObpOpsFromSavant(
    statline.ba,
    statline.slg,
    statline.woba,
    statline.bbPercent
  );

  const sharedFields = {
    playerName: statline.playerName,
    pa: statline.pa,
    ba: statline.ba,
    obp,
    slg: statline.slg,
    ops,
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

const STATLINE_COLUMNS = [
  "playerId",
  "season",
  "playerName",
  "pa",
  "ba",
  "obp",
  "slg",
  "ops",
  "woba",
  "kPercent",
  "bbPercent",
  "xba",
  "xslg",
  "xwoba",
  "hardHitPercent",
  "barrelPercent",
  "chasePercent",
  "whiffPercent",
  "zonePercent",
  "fetchedAt",
  "updatedAt",
] as const;

// Columns intentionally excluded from the bulk update set — owned by other
// write paths and must survive a daily Savant refresh untouched:
//   battingHand                     — patched from the MLB live feed
//   historicalChallengeAttempts     — incremented by rankings/audit logic
//   historicalChallengeSuccessRate  — derived from postgame audits
const STATLINE_UPDATE_COLUMNS = STATLINE_COLUMNS.filter(
  (c) => c !== "playerId" && c !== "season"
);

/**
 * Bulk upsert an entire batch of batter statlines in one (or a few chunked)
 * `INSERT ... ON CONFLICT DO UPDATE` statements — one dbGate slot per
 * statement instead of up to WRITE_CONCURRENCY slots held simultaneously.
 *
 * Player names are recorded in a second pass after the stat snapshot bulk
 * write so a failure there never blocks the primary stat data from landing.
 */
export async function upsertBatterStatlines(
  statlines: SavantBatterStatline[]
): Promise<void> {
  if (statlines.length === 0) return;

  try {
    await bulkUpsert(statlines, {
      table: "player_stat_snapshots",
      columns: [...STATLINE_COLUMNS],
      conflictColumns: ["playerId", "season"],
      updateColumns: [...STATLINE_UPDATE_COLUMNS],
      toRow: (s) => {
        const { obp, ops } = deriveObpOpsFromSavant(
          s.ba,
          s.slg,
          s.woba,
          s.bbPercent
        );
        return [
          s.playerId,
          s.season,
          s.playerName,
          s.pa,
          s.ba,
          obp,
          s.slg,
          ops,
          s.woba,
          s.kPercent,
          s.bbPercent,
          s.xba,
          s.xslg,
          s.xwoba,
          s.hardHitPercent,
          s.barrelPercent,
          s.chasePercent,
          s.whiffPercent,
          s.zonePercent,
          new Date(s.fetchedAt),
          new Date(),
        ];
      },
    });
  } catch (err) {
    console.error(
      `[playerRepository] bulk upsert failed for ${statlines.length} batter statlines:`,
      err
    );
    return;
  }

  await recordPlayerNames(
    statlines.map((s) => ({ playerId: s.playerId, fullName: s.playerName }))
  );
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

/** Patch batting hand from live feed when Savant ingest has not set it yet. */
export async function patchPlayerBattingHand(
  playerId: number,
  season: number,
  battingHand: "L" | "R" | "S"
): Promise<void> {
  await prisma.playerStatSnapshot.updateMany({
    where: { playerId, season },
    data: { battingHand },
  });
}
