/**
 * Resolves spray-weighted fielder OAA for a batter's at-bat context.
 *
 * Given the live defensive lineup, batter spray profile, and batting hand,
 * identifies which fielders cover the batter's typical contact zones and
 * returns a weighted average OAA from the fielder_oaa table.
 */

import type { DefensiveLineup } from "@abs/data-pipeline";
import { SEASONS } from "../db/constants";
import { findFielderOaaBatch } from "../db/defensiveRepository";

/**
 * Mapping from DefensiveLineup slot names (MLB live feed keys) to the OAA
 * position abbreviations used in the fielder_oaa table.
 */
const LINEUP_KEY_TO_OAA_POSITION: Record<string, string> = {
  first: "1B",
  second: "2B",
  third: "3B",
  shortstop: "SS",
  left: "LF",
  center: "CF",
  right: "RF",
};

/** Minimum spray weight (fraction of plays) a fielder must receive to be included. */
const MIN_ZONE_WEIGHT = 0.05;

interface PositionZoneWeight {
  defenseKey: string;
  oaaPosition: string;
  weight: number;
}

/**
 * Compute spray-weighted zone coverage for each defensive position.
 *
 * Given the batter's pull/straight/oppo rates and GB/FB(+LD) rates, returns a
 * list of positional weights reflecting how often this batter's typical contact
 * falls into each fielder's coverage zone.
 *
 * Returns only positions exceeding MIN_ZONE_WEIGHT after normalisation.
 * Returns an empty array when all spray inputs are null (no data available).
 */
export function computeZoneWeights(
  battingHand: string,
  pull: number,
  straight: number,
  oppo: number,
  gb: number,
  fb: number
): PositionZoneWeight[] {
  const raw: Record<string, number> = {};

  function add(key: string, w: number) {
    if (w > 0) raw[key] = (raw[key] ?? 0) + w;
  }

  if (battingHand === "R") {
    add("right", fb * pull);
    add("center", fb * straight);
    add("left", fb * oppo);
    add("shortstop", gb * (pull * 0.55 + straight * 0.45));
    add("third", gb * pull * 0.35);
    add("second", gb * (oppo * 0.55 + straight * 0.45));
    add("first", gb * oppo * 0.30);
  } else {
    add("left", fb * pull);
    add("center", fb * straight);
    add("right", fb * oppo);
    add("second", gb * (pull * 0.55 + straight * 0.45));
    add("first", gb * pull * 0.35);
    add("shortstop", gb * (oppo * 0.55 + straight * 0.45));
    add("third", gb * oppo * 0.30);
  }

  const total = Object.values(raw).reduce((s, w) => s + w, 0);
  if (total === 0) return [];

  return Object.entries(raw)
    .map(([key, w]) => ({
      defenseKey: key,
      oaaPosition: LINEUP_KEY_TO_OAA_POSITION[key],
      weight: w / total,
    }))
    .filter((z) => z.weight >= MIN_ZONE_WEIGHT && z.oaaPosition);
}

export type SprayProfileForOaa = {
  pullPercent: number | null;
  straightawayPercent: number | null;
  oppoPercent: number | null;
  gbPercent: number | null;
  fbPercent: number | null;
  ldPercent: number | null;
} | null;

/**
 * Look up and combine OAA for the fielders covering this batter's spray zone.
 *
 * Returns null when defense is absent, spray data is missing (falls back to CF),
 * or no fielder OAA rows exist for any position in the zone.
 */
export async function resolveFielderOaa(
  defense: DefensiveLineup | undefined,
  sprayProfile: SprayProfileForOaa,
  battingHand: string | null
): Promise<number | null> {
  if (!defense) return null;

  const hand = battingHand === "R" || battingHand === "L" ? battingHand : null;

  function oaaForRow(row: {
    oaa: number | null;
    oaaVsRhh: number | null;
    oaaVsLhh: number | null;
  }): number | null {
    if (hand === "R" && row.oaaVsRhh !== null) return row.oaaVsRhh;
    if (hand === "L" && row.oaaVsLhh !== null) return row.oaaVsLhh;
    return row.oaa;
  }

  async function lookupSingle(
    fielderId: number | undefined,
    position: string
  ): Promise<number | null> {
    if (!fielderId) return null;
    const rows = await findFielderOaaBatch([{ playerId: fielderId, position }], SEASONS.CURRENT);
    const row = rows[0];
    return row ? oaaForRow(row) : null;
  }

  if (!hand) {
    return lookupSingle(defense.center, "CF");
  }

  const pull = sprayProfile?.pullPercent ?? null;
  const straight = sprayProfile?.straightawayPercent ?? null;
  const oppo = sprayProfile?.oppoPercent ?? null;
  const gb = sprayProfile?.gbPercent ?? null;
  const fb = sprayProfile
    ? (sprayProfile.fbPercent ?? 0) + (sprayProfile.ldPercent ?? 0)
    : null;

  if (pull === null && straight === null && oppo === null) {
    return lookupSingle(defense.center, "CF");
  }

  const zoneWeights = computeZoneWeights(
    hand,
    pull ?? 33,
    straight ?? 34,
    oppo ?? 33,
    gb ?? 44,
    fb ?? 56
  );

  if (zoneWeights.length === 0) return null;

  const lookups: Array<{ playerId: number; position: string; weight: number }> = [];
  for (const zone of zoneWeights) {
    const fielderId = (defense as Record<string, number | undefined>)[zone.defenseKey];
    if (fielderId) {
      lookups.push({
        playerId: fielderId,
        position: zone.oaaPosition,
        weight: zone.weight,
      });
    }
  }

  if (lookups.length === 0) return null;

  const rows = await findFielderOaaBatch(
    lookups.map(({ playerId, position }) => ({ playerId, position })),
    SEASONS.CURRENT
  );

  const rowByKey = new Map(
    rows.map((row) => [`${row.playerId}:${row.position}`, row])
  );

  let weightedSum = 0;
  let weightUsed = 0;

  for (const { playerId, position, weight } of lookups) {
    const row = rowByKey.get(`${playerId}:${position}`);
    if (!row) continue;

    const oaa = oaaForRow(row);
    if (oaa === null || !Number.isFinite(oaa)) continue;

    weightedSum += oaa * weight;
    weightUsed += weight;
  }

  if (weightUsed === 0) return null;

  const average = weightedSum / weightUsed;
  return Number.isFinite(average) ? average : null;
}
