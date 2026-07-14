/**
 * Sprint Speed Repository
 *
 * Handles DB persistence for Statcast sprint speed data ingested by SavantDailyJob.
 */

import { prisma } from "./prisma";
import { recordPlayerName, recordPlayerNames } from "./playerNameRepository";
import { bulkUpsert } from "./bulkUpsert";
import type { SavantSprintSpeed } from "@abs/data-pipeline";
import type { PlayerSprintSpeed } from "@prisma/client";

export type { PlayerSprintSpeed };

export async function upsertSprintSpeedRow(
  row: SavantSprintSpeed
): Promise<PlayerSprintSpeed> {
  const sharedFields = {
    playerName: row.playerName,
    position: row.position,
    sprintSpeed: row.sprintSpeed,
    homeTo1b: row.homeTo1b,
    competitiveRuns: row.competitiveRuns,
    fetchedAt: new Date(row.fetchedAt),
  };

  return prisma.playerSprintSpeed
    .upsert({
      where: { playerId_season: { playerId: row.playerId, season: row.season } },
      update: sharedFields,
      create: { playerId: row.playerId, season: row.season, ...sharedFields },
    })
    .then(async (saved) => {
      await recordPlayerName(saved.playerId, saved.playerName);
      return saved;
    });
}

const SPRINT_COLUMNS = [
  "playerId",
  "season",
  "playerName",
  "position",
  "sprintSpeed",
  "homeTo1b",
  "competitiveRuns",
  "fetchedAt",
  "updatedAt",
] as const;

const SPRINT_UPDATE_COLUMNS = SPRINT_COLUMNS.filter(
  (c) => c !== "playerId" && c !== "season"
);

/**
 * Bulk upsert an entire batch of sprint speed rows in one (or a few chunked)
 * `INSERT ... ON CONFLICT DO UPDATE` statements instead of fanning out one
 * upsert per player.
 */
export async function upsertSprintSpeed(
  rows: SavantSprintSpeed[]
): Promise<void> {
  if (rows.length === 0) return;

  try {
    await bulkUpsert(rows, {
      table: "player_sprint_speed",
      columns: [...SPRINT_COLUMNS],
      conflictColumns: ["playerId", "season"],
      updateColumns: [...SPRINT_UPDATE_COLUMNS],
      toRow: (r) => [
        r.playerId,
        r.season,
        r.playerName,
        r.position,
        r.sprintSpeed,
        r.homeTo1b,
        r.competitiveRuns,
        new Date(r.fetchedAt),
        new Date(),
      ],
    });
  } catch (err) {
    console.error(
      `[sprintSpeedRepository] bulk upsert failed for ${rows.length} sprint speed rows:`,
      err
    );
    return;
  }

  await recordPlayerNames(
    rows.map((r) => ({ playerId: r.playerId, fullName: r.playerName }))
  );
}

export async function findSprintSpeed(
  playerId: number,
  season: number
): Promise<PlayerSprintSpeed | null> {
  return prisma.playerSprintSpeed.findUnique({
    where: { playerId_season: { playerId, season } },
  });
}

/**
 * Batch-fetch sprint speed rows for multiple players in a single query.
 */
export async function findSprintSpeedBatch(
  playerIds: number[],
  season: number
): Promise<PlayerSprintSpeed[]> {
  if (playerIds.length === 0) return [];

  return prisma.playerSprintSpeed.findMany({
    where: { season, playerId: { in: playerIds } },
  });
}
