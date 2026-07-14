import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import type { LeagueAveragesSnapshot as PipelineSnapshot } from "@abs/data-pipeline";
import type { LeagueAveragesSnapshot as DbRow } from "@prisma/client";

export type { DbRow as LeagueAveragesDbRow };

export async function upsertLeagueAveragesSnapshot(
  snapshot: PipelineSnapshot
): Promise<DbRow> {
  const fields = {
    chaseRate: snapshot.chaseRate,
    walkRate: snapshot.walkRate,
    strikeoutRate: snapshot.strikeoutRate,
    whiffRate: snapshot.whiffRate,
    ops: snapshot.ops,
    woba: snapshot.woba,
    gbRate: snapshot.gbRate,
    fbRate: snapshot.fbRate,
    ldRate: snapshot.ldRate,
    pullRate: snapshot.pullRate,
    straightawayRate: snapshot.straightawayRate,
    oppoRate: snapshot.oppoRate,
    sprintSpeed: snapshot.sprintSpeed,
    countWobaByState:
      snapshot.countWobaByState != null
        ? (snapshot.countWobaByState as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    computedAt: new Date(snapshot.computedAt),
  };

  return prisma.leagueAveragesSnapshot.upsert({
    where: { season: snapshot.season },
    update: fields,
    create: { season: snapshot.season, ...fields },
  });
}

export async function findLeagueAveragesSnapshot(
  season: number
): Promise<DbRow | null> {
  return prisma.leagueAveragesSnapshot.findUnique({ where: { season } });
}

function parseCountWobaByState(value: unknown): Record<string, number> | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [key, woba] of Object.entries(value as Record<string, unknown>)) {
    if (typeof woba === "number" && Number.isFinite(woba)) {
      result[key] = woba;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function dbRowToPipelineSnapshot(row: DbRow): PipelineSnapshot {
  return {
    season: row.season,
    chaseRate: row.chaseRate,
    walkRate: row.walkRate,
    strikeoutRate: row.strikeoutRate,
    whiffRate: row.whiffRate,
    ops: row.ops,
    woba: row.woba,
    gbRate: row.gbRate,
    fbRate: row.fbRate,
    ldRate: row.ldRate,
    pullRate: row.pullRate,
    straightawayRate: row.straightawayRate,
    oppoRate: row.oppoRate,
    sprintSpeed: row.sprintSpeed,
    countWobaByState: parseCountWobaByState(row.countWobaByState),
    computedAt: row.computedAt.toISOString(),
  };
}
