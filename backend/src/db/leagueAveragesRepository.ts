import { prisma } from "./prisma";
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
    computedAt: row.computedAt.toISOString(),
  };
}
