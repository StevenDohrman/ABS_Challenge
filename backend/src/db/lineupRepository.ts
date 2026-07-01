/**
 * Lineup Repository
 *
 * Persists batting order from the MLB live feed boxscore.
 */

import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import type { GameLineupEntry } from "@abs/data-pipeline";
import type { GameLineup } from "@prisma/client";

export type { GameLineup };

export async function upsertGameLineupEntry(
  entry: GameLineupEntry
): Promise<GameLineup> {
  const sharedFields = {
    battingOrder: entry.battingOrder,
    fetchedAt: new Date(entry.fetchedAt),
  };

  return prisma.gameLineup.upsert({
    where: {
      gamePk_teamId_playerId: {
        gamePk: entry.gamePk,
        teamId: entry.teamId,
        playerId: entry.playerId,
      },
    },
    update: sharedFields,
    create: {
      gamePk: entry.gamePk,
      teamId: entry.teamId,
      playerId: entry.playerId,
      ...sharedFields,
    },
  });
}

export async function upsertGameLineup(
  entries: GameLineupEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const results = await mapSettledWithConcurrency(
    entries,
    DB_LIMITS.WRITE_CONCURRENCY,
    (e) => upsertGameLineupEntry(e)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[lineupRepository] ${failures.length} of ${entries.length} lineup upserts failed`
    );
  }
}

/**
 * Returns batting order (player IDs sorted 1–9) for a team in a game.
 */
export async function findBattingOrder(
  gamePk: number,
  teamId: number
): Promise<number[]> {
  const rows = await prisma.gameLineup.findMany({
    where: { gamePk, teamId },
    orderBy: { battingOrder: "asc" },
    select: { playerId: true },
  });
  return rows.map((r) => r.playerId);
}
