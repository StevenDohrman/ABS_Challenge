import type { PlayerStatSnapshot } from "@prisma/client";
import type { PlayerChallengeContext } from "@abs/engine";
import type { PlayerSprayProfile } from "../db/defensiveRepository";
import { STAT_CONVERSION } from "../db/constants";

/**
 * Build a PlayerChallengeContext from a stored player stat snapshot and an
 * optional spray profile.
 *
 * Savant plate discipline metrics are stored as percentages (0–100).
 * The engine expects rates in the 0–1 range. This function performs the
 * conversion using STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR so the constant
 * documents the reason for dividing rather than leaving a bare /100.
 *
 * Spray profile fields are also stored as percentages (0–100) and converted
 * to 0–1 rates. When no spray profile is available, sprayProfile is null and
 * the engine applies a 1.0× defensive multiplier (no adjustment).
 *
 * fielderOaa is the OAA of the fielder covering this batter's primary spray
 * zone (already selected by batting-hand split in the challenge service).
 * Null → 0× OAA adjustment from the engine.
 */
export function buildPlayerChallengeContext(
  snapshot: PlayerStatSnapshot,
  sprayProfile: PlayerSprayProfile | null = null,
  fielderOaa: number | null = null
): PlayerChallengeContext {
  return {
    playerId: snapshot.playerId,

    // Batter stance — populated from the MLB Stats API when available.
    battingHand: toHandedness(snapshot.battingHand),

    // Offensive value signals (used to scale the RE delta).
    obp: finiteOrNull(snapshot.obp),
    ops: finiteOrNull(snapshot.ops),

    // Plate discipline rates — converted from stored percentages.
    walkRate: toRate(snapshot.bbPercent),
    strikeoutRate: toRate(snapshot.kPercent),
    chasePercent: toRate(snapshot.chasePercent),
    whiffPercent: toRate(snapshot.whiffPercent),

    // Historical challenge accuracy from our own DB.
    historicalChallengeAttempts: snapshot.historicalChallengeAttempts,
    historicalChallengeSuccessRate: snapshot.historicalChallengeSuccessRate,

    // Spray profile — null when the player has not been ingested yet or has
    // too few batted-ball events (sub-100 PA threshold on the Savant endpoint).
    sprayProfile: sprayProfile
      ? {
          pullPercent: toRate(sprayProfile.pullPercent),
          straightawayPercent: toRate(sprayProfile.straightawayPercent),
          oppoPercent: toRate(sprayProfile.oppoPercent),
          gbPercent: toRate(sprayProfile.gbPercent),
          fbPercent: toRate(sprayProfile.fbPercent),
          ldPercent: toRate(sprayProfile.ldPercent),
        }
      : null,

    // OAA for the fielder covering this batter's primary spray zone.
    fielderOaa: finiteOrNull(fielderOaa),
  };
}

/**
 * Returns a default PlayerChallengeContext with all optional fields null.
 * Used when no stat snapshot is available for a player yet.
 */
export function buildDefaultPlayerChallengeContext(
  playerId: number
): PlayerChallengeContext {
  return {
    playerId,
    battingHand: null,
    obp: null,
    ops: null,
    walkRate: null,
    strikeoutRate: null,
    chasePercent: null,
    whiffPercent: null,
    historicalChallengeAttempts: 0,
    historicalChallengeSuccessRate: null,
    sprayProfile: null,
    fielderOaa: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a stored Savant percentage (0–100) to a rate (0–1).
 * Returns null when the value is null (metric was not available in Savant).
 */
function toRate(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  return percent / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/**
 * Narrows a nullable string from the DB to the engine's battingHand union.
 * The DB stores "L", "R", "S", or null; any other value is treated as null.
 */
function toHandedness(
  raw: string | null
): "L" | "R" | "S" | null {
  if (raw === "L" || raw === "R" || raw === "S") return raw;
  return null;
}
