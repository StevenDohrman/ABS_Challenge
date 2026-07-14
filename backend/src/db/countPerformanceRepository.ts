/**
 * Batter count-state wOBA — persisted rollup from SavantLineupJob.
 */

import { INTERVALS } from "./constants";
import { prisma } from "./prisma";
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
