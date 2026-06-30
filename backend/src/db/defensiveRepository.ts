/**
 * Defensive Repository
 *
 * Handles DB persistence for spray profiles and fielder OAA data ingested by
 * SavantDailyJob.
 */

import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { recordPlayerName } from "./playerNameRepository";
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

export async function upsertSprayProfiles(
  profiles: SavantBatterSprayProfile[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    profiles,
    DB_LIMITS.WRITE_CONCURRENCY,
    (p) => upsertSprayProfile(p)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[defensiveRepository] ${failures.length} of ${profiles.length} spray profile upserts failed`
    );
  }
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

export async function upsertFielderOaa(
  rows: SavantFielderOaa[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    rows,
    DB_LIMITS.WRITE_CONCURRENCY,
    (r) => upsertFielderOaaRow(r)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[defensiveRepository] ${failures.length} of ${rows.length} fielder OAA upserts failed`
    );
  }
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
