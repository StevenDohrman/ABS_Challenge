/**
 * Pitcher pitch-mix repository — daily Savant arsenal + ball-rate storage.
 */

import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { recordPlayerName } from "./playerNameRepository";
import type { SavantPitcherPitchMix } from "@abs/data-pipeline";
import type { PitcherPitchMix } from "@prisma/client";

export type { PitcherPitchMix };

export async function upsertPitcherPitchMix(
  row: SavantPitcherPitchMix
): Promise<PitcherPitchMix> {
  const sharedFields = {
    pitcherName: row.pitcherName,
    pitchTypeName: row.pitchTypeName,
    usageRate: row.usageRate,
    ballRate: row.ballRate,
    strikeRate: row.strikeRate,
    pitchCount: row.pitchCount,
    fetchedAt: new Date(row.fetchedAt),
  };

  return prisma.pitcherPitchMix
    .upsert({
      where: {
        pitcherId_season_pitchType: {
          pitcherId: row.pitcherId,
          season: row.season,
          pitchType: row.pitchType,
        },
      },
      update: sharedFields,
      create: {
        pitcherId: row.pitcherId,
        season: row.season,
        pitchType: row.pitchType,
        ...sharedFields,
      },
    })
    .then(async (saved) => {
      await recordPlayerName(saved.pitcherId, saved.pitcherName);
      return saved;
    });
}

export async function upsertPitcherPitchMixBatch(
  rows: SavantPitcherPitchMix[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    rows,
    DB_LIMITS.WRITE_CONCURRENCY,
    (row) => upsertPitcherPitchMix(row)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[pitcherPitchMixRepository] ${failures.length} of ${rows.length} pitch mix upserts failed`
    );
  }
}

export async function findPitchMixForPitcher(
  pitcherId: number,
  season: number
): Promise<PitcherPitchMix[]> {
  return prisma.pitcherPitchMix.findMany({
    where: { pitcherId, season },
    orderBy: [{ usageRate: "desc" }, { pitchCount: "desc" }],
  });
}
