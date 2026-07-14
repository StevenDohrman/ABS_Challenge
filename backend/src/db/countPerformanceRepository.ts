/**
 * Batter count-state wOBA — persisted rollup from SavantLineupJob.
 */

import { INTERVALS } from "./constants";
import { prisma } from "./prisma";
import { bulkUpsert } from "./bulkUpsert";
import type { Prisma } from "@prisma/client";
import type { PlayerCountPerformanceMap } from "@abs/data-pipeline";
import type { PlayerCountPerformance } from "@prisma/client";

export type { PlayerCountPerformance };

function parseBuckets(value: unknown): PlayerCountPerformanceMap | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const map: PlayerCountPerformanceMap = {};
  for (const [key, bucket] of Object.entries(value as Record<string, unknown>)) {
    if (bucket == null || typeof bucket !== "object" || Array.isArray(bucket)) {
      continue;
    }
    const row = bucket as Record<string, unknown>;
    const paCount = row.paCount;
    const woba = row.woba;
    if (typeof paCount !== "number" || typeof woba !== "number") continue;

    map[key] = {
      paCount,
      woba,
      xwoba: typeof row.xwoba === "number" ? row.xwoba : null,
    };
  }

  return Object.keys(map).length > 0 ? map : null;
}

export async function upsertPlayerCountPerformance(
  playerId: number,
  season: number,
  buckets: PlayerCountPerformanceMap,
  fetchedAt: Date
): Promise<PlayerCountPerformance> {
  const sharedFields = {
    buckets: buckets as unknown as Prisma.InputJsonValue,
    fetchedAt,
  };

  return prisma.playerCountPerformance.upsert({
    where: { playerId_season: { playerId, season } },
    update: sharedFields,
    create: { playerId, season, ...sharedFields },
  });
}

export interface PlayerCountPerformanceRow {
  playerId: number;
  season: number;
  buckets: PlayerCountPerformanceMap;
  fetchedAt: Date;
}

const COUNT_PERFORMANCE_COLUMNS = [
  "playerId",
  "season",
  "buckets",
  "fetchedAt",
  "updatedAt",
] as const;

const COUNT_PERFORMANCE_UPDATE_COLUMNS = ["buckets", "fetchedAt", "updatedAt"];

/**
 * Bulk upsert per-batter count-state wOBA rollups collected from a
 * SavantLineupJob run — one statement instead of one upsert per batter
 * (Phase 8B). `buckets` is JSONB, so its bound parameter is cast explicitly.
 */
export async function bulkUpsertPlayerCountPerformance(
  rows: PlayerCountPerformanceRow[]
): Promise<void> {
  if (rows.length === 0) return;

  await bulkUpsert(rows, {
    table: "player_count_performance",
    columns: [...COUNT_PERFORMANCE_COLUMNS],
    conflictColumns: ["playerId", "season"],
    updateColumns: COUNT_PERFORMANCE_UPDATE_COLUMNS,
    casts: { buckets: "jsonb" },
    toRow: (r) => [
      r.playerId,
      r.season,
      JSON.stringify(r.buckets),
      r.fetchedAt,
      new Date(),
    ],
  });
}

export async function findPlayerCountPerformance(
  playerId: number,
  season: number
): Promise<PlayerCountPerformanceMap | null> {
  const row = await prisma.playerCountPerformance.findUnique({
    where: { playerId_season: { playerId, season } },
    select: { buckets: true },
  });
  if (!row) return null;
  return parseBuckets(row.buckets);
}

export async function findRecentlyRefreshedPerformancePlayerIds(
  playerIds: number[],
  season: number,
  maxAgeMs: number = INTERVALS.SIX_HOURS_MS
): Promise<Set<number>> {
  if (playerIds.length === 0) return new Set();

  const cutoff = new Date(Date.now() - maxAgeMs);
  const rows = await prisma.playerCountPerformance.findMany({
    where: {
      season,
      playerId: { in: playerIds },
      fetchedAt: { gte: cutoff },
    },
    select: { playerId: true },
  });

  return new Set(rows.map((row) => row.playerId));
}
