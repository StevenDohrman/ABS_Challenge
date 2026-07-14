/**
 * Pitcher pitch-mix repository — daily Savant arsenal + ball-rate storage.
 */

import { prisma } from "./prisma";
import { recordPlayerName, recordPlayerNames } from "./playerNameRepository";
import { bulkUpsert } from "./bulkUpsert";
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

const PITCH_MIX_COLUMNS = [
  "pitcherId",
  "season",
  "pitchType",
  "pitcherName",
  "pitchTypeName",
  "usageRate",
  "ballRate",
  "strikeRate",
  "pitchCount",
  "fetchedAt",
  "updatedAt",
] as const;

const PITCH_MIX_UPDATE_COLUMNS = PITCH_MIX_COLUMNS.filter(
  (c) => c !== "pitcherId" && c !== "season" && c !== "pitchType"
);

/**
 * Bulk upsert an entire batch of pitch-mix rows in one (or a few chunked)
 * `INSERT ... ON CONFLICT DO UPDATE` statements. This is the largest Savant
 * table (~1000+ rows/day across all pitchers), so chunking matters most here.
 */
export async function upsertPitcherPitchMixBatch(
  rows: SavantPitcherPitchMix[]
): Promise<void> {
  if (rows.length === 0) return;

  try {
    await bulkUpsert(rows, {
      table: "pitcher_pitch_mix",
      columns: [...PITCH_MIX_COLUMNS],
      conflictColumns: ["pitcherId", "season", "pitchType"],
      updateColumns: [...PITCH_MIX_UPDATE_COLUMNS],
      toRow: (row) => [
        row.pitcherId,
        row.season,
        row.pitchType,
        row.pitcherName,
        row.pitchTypeName,
        row.usageRate,
        row.ballRate,
        row.strikeRate,
        row.pitchCount,
        new Date(row.fetchedAt),
        new Date(),
      ],
    });
  } catch (err) {
    console.error(
      `[pitcherPitchMixRepository] bulk upsert failed for ${rows.length} pitch mix rows:`,
      err
    );
    return;
  }

  await recordPlayerNames(
    rows.map((row) => ({ playerId: row.pitcherId, fullName: row.pitcherName }))
  );
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
