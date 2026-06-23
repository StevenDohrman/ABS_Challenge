import type { PlayerStatSnapshot } from "@prisma/client";
import type { PlayerChallengeContext } from "@abs/engine";
import { STAT_CONVERSION } from "../db/constants";

/**
 * Build a PlayerChallengeContext from a stored player stat snapshot.
 *
 * Savant plate discipline metrics are stored as percentages (0–100).
 * The engine expects rates in the 0–1 range. This function performs the
 * conversion using STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR so the constant
 * documents the reason for dividing rather than leaving a bare /100.
 *
 * Fields not yet populated (battingHand, obp, ops) are passed as null.
 * The engine handles nulls gracefully — they result in no adjustment for
 * that specific signal rather than throwing an error.
 */
export function buildPlayerChallengeContext(
  snapshot: PlayerStatSnapshot
): PlayerChallengeContext {
  return {
    playerId: snapshot.playerId,

    // Batter stance — populated from the MLB Stats API when available.
    // Null here until we wire the handedness enrichment step.
    battingHand: toHandedness(snapshot.battingHand),

    // Offensive value signals (used to scale the RE delta).
    obp: snapshot.obp,
    ops: snapshot.ops,

    // Plate discipline rates — converted from stored percentages.
    walkRate: toRate(snapshot.bbPercent),
    strikeoutRate: toRate(snapshot.kPercent),
    chasePercent: toRate(snapshot.chasePercent),
    whiffPercent: toRate(snapshot.whiffPercent),

    // Historical challenge accuracy from our own DB.
    historicalChallengeAttempts: snapshot.historicalChallengeAttempts,
    historicalChallengeSuccessRate: snapshot.historicalChallengeSuccessRate,
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
  return percent === null
    ? null
    : percent / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR;
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
