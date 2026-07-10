import axios from "axios";
import { parseCsvToRows } from "./savant.parser";

/** Mirrors engine LeagueAverages + metadata for the daily Savant refresh. */
export interface LeagueAveragesSnapshot {
  season: number;
  chaseRate: number;
  walkRate: number;
  strikeoutRate: number;
  whiffRate: number;
  ops: number;
  woba: number;
  computedAt: string;
}

const FALLBACKS = {
  chaseRate: 0.3,
  walkRate: 0.085,
  strikeoutRate: 0.225,
  whiffRate: 0.25,
  ops: 0.728,
  woba: 0.315,
} as const;

function columnMean(rows: Record<string, string>[], column: string): number | null {
  const values = rows
    .map((r) => parseFloat(r[column] ?? ""))
    .filter((v) => !Number.isNaN(v));

  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function columnMeanFromKeys(
  rows: Record<string, string>[],
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const mean = columnMean(rows, key);
    if (mean !== null) return mean;
  }
  return null;
}

interface MlbLeagueStatsResponse {
  stats: Array<{
    splits: Array<{
      stat: {
        ops?: string;
      };
    }>;
  }>;
}

/** League aggregate OPS from MLB Stats API (one lightweight call per daily refresh). */
export async function fetchLeagueOps(year: number): Promise<number | null> {
  try {
    const { data } = await axios.get<MlbLeagueStatsResponse>(
      "https://statsapi.mlb.com/api/v1/stats",
      {
        params: {
          stats: "season",
          group: "hitting",
          gameType: "R",
          season: year,
          sportId: 1,
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

/**
 * Compute league-average batter rates from Savant CSVs already fetched for
 * batter statlines — no extra Savant HTTP calls.
 */
export function computeLeagueAveragesFromCsvs(
  disciplineCsv: string,
  expectedStatsCsv: string,
  season: number,
  leagueOps: number | null,
  computedAt = new Date().toISOString()
): LeagueAveragesSnapshot {
  const disciplineRows = parseCsvToRows(disciplineCsv);
  const expectedRows = parseCsvToRows(expectedStatsCsv);

  const chaseRaw = columnMeanFromKeys(disciplineRows, "oz_swing_percent");
  const whiffRaw = columnMeanFromKeys(disciplineRows, "whiff_percent");
  const bbRaw = columnMeanFromKeys(expectedRows, "bb%", "bb_percent");
  const kRaw = columnMeanFromKeys(expectedRows, "k%", "k_percent");
  const wobaRaw = columnMeanFromKeys(expectedRows, "woba", "woba_value");

  return {
    season,
    chaseRate: chaseRaw !== null ? chaseRaw / 100 : FALLBACKS.chaseRate,
    walkRate: bbRaw !== null ? bbRaw / 100 : FALLBACKS.walkRate,
    strikeoutRate: kRaw !== null ? kRaw / 100 : FALLBACKS.strikeoutRate,
    whiffRate: whiffRaw !== null ? whiffRaw / 100 : FALLBACKS.whiffRate,
    ops: leagueOps ?? FALLBACKS.ops,
    woba: wobaRaw ?? FALLBACKS.woba,
    computedAt,
  };
}

/**
 * Fetches Savant CSVs + MLB league OPS. Used by the CLI script; the daily job
 * should prefer computeLeagueAveragesFromCsvs to avoid duplicate Savant fetches.
 */
export async function computeCurrentLeagueAverages(
  year: number,
  fetchCsv: {
    discipline: (season: number) => Promise<string>;
    expected: (season: number) => Promise<string>;
  }
): Promise<LeagueAveragesSnapshot> {
  const [disciplineCsv, expectedCsv, leagueOps] = await Promise.all([
    fetchCsv.discipline(year),
    fetchCsv.expected(year),
    fetchLeagueOps(year),
  ]);

  return computeLeagueAveragesFromCsvs(
    disciplineCsv,
    expectedCsv,
    year,
    leagueOps
  );
}
