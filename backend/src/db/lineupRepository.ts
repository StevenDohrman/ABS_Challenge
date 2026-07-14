/**
 * Lineup Repository
 *
 * Persists batting order from the MLB live feed boxscore.
 */

import { prisma } from "./prisma";
import { bulkUpsert } from "./bulkUpsert";
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

const LINEUP_COLUMNS = [
  "gamePk",
  "teamId",
  "playerId",
  "battingOrder",
  "fetchedAt",
  "updatedAt",
] as const;

const LINEUP_UPDATE_COLUMNS = ["battingOrder", "fetchedAt", "updatedAt"];

/**
 * Bulk upsert a game's full lineup (both teams, ~18–26 rows) in a single
 * `INSERT ... ON CONFLICT DO UPDATE` statement instead of fanning out one
 * upsert per entry (Phase 8B).
 */
export async function upsertGameLineup(
  entries: GameLineupEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  try {
    await bulkUpsert(entries, {
      table: "game_lineups",
      columns: [...LINEUP_COLUMNS],
      conflictColumns: ["gamePk", "teamId", "playerId"],
      updateColumns: LINEUP_UPDATE_COLUMNS,
      toRow: (e) => [
        e.gamePk,
        e.teamId,
        e.playerId,
        e.battingOrder,
        new Date(e.fetchedAt),
        new Date(),
      ],
    });
  } catch (err) {
    console.error(
      `[lineupRepository] bulk upsert failed for game ${entries[0]?.gamePk} ` +
      `(${entries.length} entries):`,
      err
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

/** All lineup rows for a game (both teams), read-only. */
export async function findGameLineups(gamePk: number): Promise<GameLineup[]> {
  return prisma.gameLineup.findMany({
    where: { gamePk },
    orderBy: [{ teamId: "asc" }, { battingOrder: "asc" }],
  });
}
