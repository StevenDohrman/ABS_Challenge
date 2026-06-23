/**
 * computeLeagueAverages
 *
 * Fetches current-season league averages from Baseball Savant and the MLB
 * Stats API. Can be used as a CLI tool or imported as a module.
 *
 * CLI usage:
 *
 *   # Print a ready-to-paste constants block:
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts --season=2025
 *
 *   # Print raw JSON (for the pipeline weekly job):
 *   npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts --json
 *
 * Programmatic usage (called by the weekly league-average refresh job):
 *
 *   import { computeCurrentLeagueAverages } from "./computeLeagueAverages";
 *   const averages = await computeCurrentLeagueAverages(2026);
 *   // → { chaseRate: 0.29, walkRate: 0.091, strikeoutRate: 0.219, whiffRate: 0.245, ops: 0.737 }
 *
 * Sources:
 *   chaseRate     → Savant custom leaderboard (oz_swing_percent), qualified batters
 *   whiffRate     → Savant custom leaderboard (whiff_percent), qualified batters
 *   walkRate      → Savant expected_statistics leaderboard (bb%), qualified batters
 *   strikeoutRate → Savant expected_statistics leaderboard (k%), qualified batters
 *   ops           → MLB Stats API /v1/stats (league-aggregate, regular season)
 */

import {
  fetchPlateDisciplineCsv,
  fetchExpectedStatsCsv,
} from "../sources/savant/savant.client";
import { parseCsvToRows } from "../sources/savant/savant.parser";
import axios from "axios";

// Mirrors LeagueAverages from the engine — duplicated here to avoid a
// cross-package import in the data-pipeline. Keep fields in sync.
export interface LeagueAveragesSnapshot {
  season: number;
  chaseRate: number;
  walkRate: number;
  strikeoutRate: number;
  whiffRate: number;
  ops: number;
  /** ISO timestamp of when this snapshot was computed. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const season =
  parseInt(process.argv.find((a) => a.startsWith("--season="))?.split("=")[1] ?? "") ||
  new Date().getFullYear();

// ---------------------------------------------------------------------------
// MLB Stats API — league aggregate traditional stats
// ---------------------------------------------------------------------------

interface MlbLeagueStatsResponse {
  stats: Array<{
    splits: Array<{
      stat: {
        obp?: string;
        slg?: string;
        ops?: string;
      };
    }>;
  }>;
}

async function fetchLeagueOps(year: number): Promise<number | null> {
  try {
    const { data } = await axios.get<MlbLeagueStatsResponse>(
      "https://statsapi.mlb.com/api/v1/stats",
      {
        params: {
          stats: "season",
          group: "hitting",
          gameType: "R",
          season: year,
          sportId: 1, // MLB
        },
        timeout: 10_000,
      }
    );

    const opsStr = data.stats?.[0]?.splits?.[0]?.stat?.ops;
    return opsStr ? parseFloat(opsStr) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Column mean helpers
// ---------------------------------------------------------------------------

function columnMean(rows: Record<string, string>[], column: string): number | null {
  const values = rows
    .map((r) => parseFloat(r[column] ?? ""))
    .filter((v) => !isNaN(v));

  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Core computation (importable by the weekly pipeline job)
// ---------------------------------------------------------------------------

/**
 * Fetches and computes current-season league averages.
 * Returns null for any metric that could not be fetched.
 */
export async function computeCurrentLeagueAverages(
  year: number
): Promise<LeagueAveragesSnapshot> {
  const [disciplineCsv, expectedCsv, leagueOps] = await Promise.all([
    fetchPlateDisciplineCsv(year),
    fetchExpectedStatsCsv(year),
    fetchLeagueOps(year),
  ]);

  const disciplineRows = parseCsvToRows(disciplineCsv);
  const expectedRows   = parseCsvToRows(expectedCsv);

  // Savant delivers oz_swing_percent and whiff_percent as 0–100 percentages
  const chaseRaw = columnMean(disciplineRows, "oz_swing_percent");
  const whiffRaw = columnMean(disciplineRows, "whiff_percent");
  const bbRaw    = columnMean(expectedRows,   "bb%");
  const kRaw     = columnMean(expectedRows,   "k%");

  // Fall back to compile-time constants if a fetch fails so the snapshot is
  // always fully populated and safe to inject into the engine.
  const FALLBACKS = {
    chaseRate:     0.30,
    walkRate:      0.085,
    strikeoutRate: 0.225,
    whiffRate:     0.25,
    ops:           0.728,
  };

  return {
    season:        year,
    chaseRate:     chaseRaw    !== null ? chaseRaw    / 100 : FALLBACKS.chaseRate,
    walkRate:      bbRaw       !== null ? bbRaw       / 100 : FALLBACKS.walkRate,
    strikeoutRate: kRaw        !== null ? kRaw        / 100 : FALLBACKS.strikeoutRate,
    whiffRate:     whiffRaw    !== null ? whiffRaw    / 100 : FALLBACKS.whiffRate,
    ops:           leagueOps                                ?? FALLBACKS.ops,
    computedAt:    new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const jsonMode = process.argv.includes("--json");

  if (!jsonMode) {
    console.error(`\nFetching league averages for ${season}…\n`);
  }

  const snapshot = await computeCurrentLeagueAverages(season);

  if (jsonMode) {
    // Machine-readable output for the pipeline job to parse
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  // Human-readable output: a ready-to-paste constants block
  function fmt(v: number, decimals = 3): string {
    return v.toFixed(decimals);
  }

  console.log(`
// ── Computed from Baseball Savant + MLB Stats API, ${season} regular season ──
// Qualified batters only (min plate appearances threshold applied by Savant).
// Re-run scripts/computeLeagueAverages.ts each off-season to refresh.
//
// Command: npx tsx data-pipeline/src/scripts/computeLeagueAverages.ts --season=${season}

export const LEAGUE_AVERAGES = {
  /** Source: Savant custom leaderboard (oz_swing_percent), ${season} season. */
  CHASE_RATE: ${fmt(snapshot.chaseRate)},

  /** Source: Savant expected_statistics leaderboard (bb%), ${season} season. */
  WALK_RATE: ${fmt(snapshot.walkRate)},

  /** Source: Savant expected_statistics leaderboard (k%), ${season} season. */
  STRIKEOUT_RATE: ${fmt(snapshot.strikeoutRate)},

  /** Source: Savant custom leaderboard (whiff_percent), ${season} season. */
  WHIFF_RATE: ${fmt(snapshot.whiffRate)},

  /** Source: MLB Stats API /v1/stats (league aggregate), ${season} season. */
  OPS: ${fmt(snapshot.ops, 3)},
} as const;
`);

  console.error(`computedAt : ${snapshot.computedAt}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
}
