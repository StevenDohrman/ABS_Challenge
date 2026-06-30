/**
 * Sprint Speed Repository
 *
 * Handles DB persistence for Statcast sprint speed data ingested by SavantDailyJob.
 */

import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { recordPlayerName } from "./playerNameRepository";
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

export async function upsertSprintSpeed(
  rows: SavantSprintSpeed[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    rows,
    DB_LIMITS.WRITE_CONCURRENCY,
    (r) => upsertSprintSpeedRow(r)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[sprintSpeedRepository] ${failures.length} of ${rows.length} sprint speed upserts failed`
    );
  }
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
