import type { LeagueAverages } from "@abs/engine";
import type { LeagueAveragesSnapshot } from "@abs/data-pipeline";
import { SEASONS } from "../db/constants";
import {
  findLeagueAveragesSnapshot,
  dbRowToPipelineSnapshot,
  upsertLeagueAveragesSnapshot,
} from "../db/leagueAveragesRepository";

let currentSnapshot: LeagueAveragesSnapshot | null = null;

export async function hydrateLeagueAveragesFromDb(
  season: number = SEASONS.CURRENT
): Promise<void> {
  const row = await findLeagueAveragesSnapshot(season);
  if (!row) return;
  setLeagueAverages(dbRowToPipelineSnapshot(row));
}

export function setLeagueAverages(snapshot: LeagueAveragesSnapshot): void {
  currentSnapshot = snapshot;
  console.log(
    `[leagueAverages] refreshed ${snapshot.season} — chase=${snapshot.chaseRate.toFixed(3)} ` +
      `ops=${snapshot.ops.toFixed(3)} woba=${snapshot.woba.toFixed(3)} ` +
      `gb=${snapshot.gbRate.toFixed(3)} sprint=${snapshot.sprintSpeed.toFixed(1)}`
  );
}

export async function persistLeagueAverages(
  snapshot: LeagueAveragesSnapshot
): Promise<void> {
  await upsertLeagueAveragesSnapshot(snapshot);
  setLeagueAverages(snapshot);
}

export function getLeagueAveragesSnapshot(): LeagueAveragesSnapshot | null {
  return currentSnapshot;
}

/** Spray defaults on the 0–100 scale used by fielder OAA zone weights. */
export function getLeagueSprayDefaultsPercent(): {
  pull: number;
  straight: number;
  oppo: number;
  gb: number;
  fb: number;
} | null {
  if (!currentSnapshot || currentSnapshot.season !== SEASONS.CURRENT) {
    return null;
  }
  const snap = currentSnapshot;
  return {
    pull: snap.pullRate * 100,
    straight: snap.straightawayRate * 100,
    oppo: snap.oppoRate * 100,
    gb: snap.gbRate * 100,
    fb: Math.round((snap.fbRate + snap.ldRate) * 1000) / 10,
  };
}

/** Engine override for the current season; undefined only before any hydrate. */
export function getLeagueAveragesForEngine(): Partial<LeagueAverages> | undefined {
  if (!currentSnapshot || currentSnapshot.season !== SEASONS.CURRENT) {
    return undefined;
  }

  const snap = currentSnapshot;
  return {
    chaseRate: snap.chaseRate,
    walkRate: snap.walkRate,
    strikeoutRate: snap.strikeoutRate,
    whiffRate: snap.whiffRate,
    ops: snap.ops,
    woba: snap.woba,
    gbRate: snap.gbRate,
    fbRate: snap.fbRate,
    ldRate: snap.ldRate,
    pullRate: snap.pullRate,
    straightawayRate: snap.straightawayRate,
    oppoRate: snap.oppoRate,
    sprintSpeed: snap.sprintSpeed,
  };
}

/** Test helper. */
export function resetLeagueAveragesForTests(): void {
  currentSnapshot = null;
}
