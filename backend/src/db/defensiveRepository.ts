/**
 * Defensive Repository
 *
 * Handles DB persistence for spray profiles and OAA data ingested by
 * SavantDailyJob. All three tables use (playerId, season) or
 * (playerId, season, position) as their natural unique key.
 */

import { prisma } from "./prisma";
import { DB_LIMITS } from "./constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import type {
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantOutfieldDirectionalOaa,
} from "@abs/data-pipeline";
import type {
  PlayerSprayProfile,
  FielderOaa,
  OutfieldDirectionalOaa,
} from "@prisma/client";

export type { PlayerSprayProfile, FielderOaa, OutfieldDirectionalOaa };

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

// ─────────────────────────────────────────────────────────────────────────────
// outfield_directional_oaa
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertOutfieldDirectionalOaaRow(
  row: SavantOutfieldDirectionalOaa
): Promise<OutfieldDirectionalOaa> {
  const sharedFields = {
    playerName: row.playerName,
    position: row.position,
    oaa: row.oaa,
    oaaLeft: row.oaaLeft,
    oaaStraight: row.oaaStraight,
    oaaRight: row.oaaRight,
    reaction: row.reaction,
    burst: row.burst,
    route: row.route,
    fetchedAt: new Date(row.fetchedAt),
  };

  return prisma.outfieldDirectionalOaa.upsert({
    where: { playerId_season: { playerId: row.playerId, season: row.season } },
    update: sharedFields,
    create: { playerId: row.playerId, season: row.season, ...sharedFields },
  });
}

export async function upsertOutfieldDirectionalOaa(
  rows: SavantOutfieldDirectionalOaa[]
): Promise<void> {
  const results = await mapSettledWithConcurrency(
    rows,
    DB_LIMITS.WRITE_CONCURRENCY,
    (r) => upsertOutfieldDirectionalOaaRow(r)
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[defensiveRepository] ${failures.length} of ${rows.length} outfield directional OAA upserts failed`
    );
  }
}

export async function findOutfieldDirectionalOaa(
  playerId: number,
  season: number
): Promise<OutfieldDirectionalOaa | null> {
  return prisma.outfieldDirectionalOaa.findUnique({
    where: { playerId_season: { playerId, season } },
  });
}
