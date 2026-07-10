import type { LeagueAverages } from "@abs/engine";
import type { LeagueAveragesSnapshot } from "@abs/data-pipeline";
import { SEASONS } from "../db/constants";

let currentSnapshot: LeagueAveragesSnapshot | null = null;

export function setLeagueAverages(snapshot: LeagueAveragesSnapshot): void {
  currentSnapshot = snapshot;
  console.log(
    `[leagueAverages] refreshed ${snapshot.season} — chase=${snapshot.chaseRate.toFixed(3)} ` +
      `walk=${snapshot.walkRate.toFixed(3)} ops=${snapshot.ops.toFixed(3)} ` +
      `woba=${snapshot.woba.toFixed(3)}`
  );
}

export function getLeagueAveragesSnapshot(): LeagueAveragesSnapshot | null {
  return currentSnapshot;
}

/** Engine override for the current season; undefined falls back to compile-time constants. */
export function getLeagueAveragesForEngine(): Partial<LeagueAverages> | undefined {
  if (!currentSnapshot || currentSnapshot.season !== SEASONS.CURRENT) {
    return undefined;
  }

  return {
    chaseRate: currentSnapshot.chaseRate,
    walkRate: currentSnapshot.walkRate,
    strikeoutRate: currentSnapshot.strikeoutRate,
    whiffRate: currentSnapshot.whiffRate,
    ops: currentSnapshot.ops,
    woba: currentSnapshot.woba,
  };
}

/** Test helper. */
export function resetLeagueAveragesForTests(): void {
  currentSnapshot = null;
}
