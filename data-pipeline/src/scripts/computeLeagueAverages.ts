/**
 * computeLeagueAverages
 *
 * CLI tool to print league-average constants from Savant + MLB Stats API.
 *
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts --season=2025
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts --json
 *
 * The SavantDailyJob computes the same snapshot from CSVs it already fetches;
 * this script is for manual inspection or off-season constant refresh.
 */

import {
  fetchExpectedStatsCsv,
  fetchPlateDisciplineCsv,
  fetchSprayProfileCsv,
  fetchSprintSpeedCsv,
} from "../sources/savant/savant.client";
import { computeCurrentLeagueAverages } from "../sources/savant/leagueAverages";

const season =
  parseInt(process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "") ||
  new Date().getFullYear();

async function main() {
  const jsonMode = process.argv.includes("--json");

  if (!jsonMode) {
    console.error(`\nFetching league averages for ${season}…\n`);
  }

  const snapshot = await computeCurrentLeagueAverages(season, {
    discipline: fetchPlateDisciplineCsv,
    expected: fetchExpectedStatsCsv,
    spray: fetchSprayProfileCsv,
    sprint: fetchSprintSpeedCsv,
  });

  if (jsonMode) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  function fmt(v: number, decimals = 3): string {
    return v.toFixed(decimals);
  }

  console.log(`
// ── Computed from Baseball Savant + MLB Stats API, ${season} regular season ──
// Qualified batters only (min plate appearances threshold applied by Savant).
// SavantDailyJob refreshes these daily; this script is for manual inspection.

export const LEAGUE_AVERAGES = {
  CHASE_RATE: ${fmt(snapshot.chaseRate)},
  WALK_RATE: ${fmt(snapshot.walkRate)},
  STRIKEOUT_RATE: ${fmt(snapshot.strikeoutRate)},
  WHIFF_RATE: ${fmt(snapshot.whiffRate)},
  OPS: ${fmt(snapshot.ops, 3)},
} as const;

// woba (lineup context): ${fmt(snapshot.woba, 3)}
// gbRate: ${fmt(snapshot.gbRate)}  fbRate: ${fmt(snapshot.fbRate)}  ldRate: ${fmt(snapshot.ldRate)}
// sprintSpeed: ${fmt(snapshot.sprintSpeed, 1)}
`);

  console.error(`computedAt : ${snapshot.computedAt}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
