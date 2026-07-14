/**
 * Defensive Repository
 *
 * Handles DB persistence for spray profiles and fielder OAA data ingested by
 * SavantDailyJob.
 */

import { prisma } from "./prisma";
import { recordPlayerName, recordPlayerNames } from "./playerNameRepository";
import { bulkUpsert } from "./bulkUpsert";
import type {
  SavantBatterSprayProfile,
  SavantFielderOaa,
} from "@abs/data-pipeline";
import type {
  PlayerSprayProfile,
  FielderOaa,
} from "@prisma/client";

export type { PlayerSprayProfile, FielderOaa };

// ─────────────────────────────────────────────────────────────────────────────
// player_spray_profiles
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertSprayProfile(
  profile: SavantBatterSprayProfile
): Promise<PlayerSprayProfile> {
  const sharedFields = {
    playerName: profile.playerName,
    pa: profile.pa,
    pullPercent: profile.pullPercent,
    straightawayPercent: profile.straightawayPercent,
    oppoPercent: profile.oppoPercent,
    gbPercent: profile.gbPercent,
    fbPercent: profile.fbPercent,
    ldPercent: profile.ldPercent,
    fetchedAt: new Date(profile.fetchedAt),
  };

  return prisma.playerSprayProfile.upsert({
    where: { playerId_season: { playerId: profile.playerId, season: profile.season } },
    update: sharedFields,
    create: { playerId: profile.playerId, season: profile.season, ...sharedFields },
  }).then(async (row) => {
    await recordPlayerName(row.playerId, row.playerName);
    return row;
  });
}

const SPRAY_COLUMNS = [
  "playerId",
  "season",
  "playerName",
  "pa",
  "pullPercent",
  "straightawayPercent",
  "oppoPercent",
  "gbPercent",
  "fbPercent",
  "ldPercent",
  "fetchedAt",
  "updatedAt",
] as const;

const SPRAY_UPDATE_COLUMNS = SPRAY_COLUMNS.filter(
  (c) => c !== "playerId" && c !== "season"
);

/**
 * Bulk upsert an entire batch of spray profiles in one (or a few chunked)
 * `INSERT ... ON CONFLICT DO UPDATE` statements instead of fanning out one
 * upsert per player.
 */
export async function upsertSprayProfiles(
  profiles: SavantBatterSprayProfile[]
): Promise<void> {
  if (profiles.length === 0) return;

  try {
    await bulkUpsert(profiles, {
      table: "player_spray_profiles",
      columns: [...SPRAY_COLUMNS],
      conflictColumns: ["playerId", "season"],
      updateColumns: [...SPRAY_UPDATE_COLUMNS],
      toRow: (p) => [
        p.playerId,
        p.season,
        p.playerName,
        p.pa,
        p.pullPercent,
        p.straightawayPercent,
        p.oppoPercent,
        p.gbPercent,
        p.fbPercent,
        p.ldPercent,
        new Date(p.fetchedAt),
        new Date(),
      ],
    });
  } catch (err) {
    console.error(
      `[defensiveRepository] bulk upsert failed for ${profiles.length} spray profiles:`,
      err
    );
    return;
  }

  await recordPlayerNames(
    profiles.map((p) => ({ playerId: p.playerId, fullName: p.playerName }))
  );
}

export async function findSprayProfile(
  playerId: number,
  season: number
): Promise<PlayerSprayProfile | null> {
  return prisma.playerSprayProfile.findUnique({
    where: { playerId_season: { playerId, season } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// fielder_oaa
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertFielderOaaRow(
  row: SavantFielderOaa
): Promise<FielderOaa> {
  const sharedFields = {
    playerName: row.playerName,
    oaa: row.oaa,
    oaaVsRhh: row.oaaVsRhh,
    oaaVsLhh: row.oaaVsLhh,
    fetchedAt: new Date(row.fetchedAt),
  };

  return prisma.fielderOaa.upsert({
    where: {
      playerId_season_position: {
        playerId: row.playerId,
        season: row.season,
        position: row.position,
      },
    },
    update: sharedFields,
    create: {
      playerId: row.playerId,
      season: row.season,
      position: row.position,
      ...sharedFields,
    },
  }).then(async (saved) => {
    await recordPlayerName(saved.playerId, saved.playerName);
    return saved;
  });
}

const OAA_COLUMNS = [
  "playerId",
  "season",
  "position",
  "playerName",
  "oaa",
  "oaaVsRhh",
  "oaaVsLhh",
  "fetchedAt",
  "updatedAt",
] as const;

const OAA_UPDATE_COLUMNS = OAA_COLUMNS.filter(
  (c) => c !== "playerId" && c !== "season" && c !== "position"
);

/**
 * Bulk upsert an entire batch of fielder OAA rows in one (or a few chunked)
 * `INSERT ... ON CONFLICT DO UPDATE` statements instead of fanning out one
 * upsert per fielder/position row.
 */
export async function upsertFielderOaa(
  rows: SavantFielderOaa[]
): Promise<void> {
  if (rows.length === 0) return;

  try {
    await bulkUpsert(rows, {
      table: "fielder_oaa",
      columns: [...OAA_COLUMNS],
      conflictColumns: ["playerId", "season", "position"],
      updateColumns: [...OAA_UPDATE_COLUMNS],
      toRow: (r) => [
        r.playerId,
        r.season,
        r.position,
        r.playerName,
        r.oaa,
        r.oaaVsRhh,
        r.oaaVsLhh,
        new Date(r.fetchedAt),
        new Date(),
      ],
    });
  } catch (err) {
    console.error(
      `[defensiveRepository] bulk upsert failed for ${rows.length} fielder OAA rows:`,
      err
    );
    return;
  }

  await recordPlayerNames(
    rows.map((r) => ({ playerId: r.playerId, fullName: r.playerName }))
  );
}

/**
 * Find a fielder's OAA row for a given position and season.
 * Returns null when no data is available.
 */
export async function findFielderOaa(
  playerId: number,
  season: number,
  position: string
): Promise<FielderOaa | null> {
  return prisma.fielderOaa.findUnique({
    where: { playerId_season_position: { playerId, season, position } },
  });
}

export interface FielderOaaLookup {
  playerId: number;
  position: string;
}

/**
 * Batch-fetch OAA rows for multiple fielder/position pairs in a single query.
 * Used during at-bat precompute to avoid N sequential lookups exhausting the
 * connection pool when resolving spray-zone coverage.
 */
export async function findFielderOaaBatch(
  lookups: FielderOaaLookup[],
  season: number
): Promise<FielderOaa[]> {
  if (lookups.length === 0) return [];

  return prisma.fielderOaa.findMany({
    where: {
      season,
      OR: lookups.map(({ playerId, position }) => ({ playerId, position })),
    },
  });
}
