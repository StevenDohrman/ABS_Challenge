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
  /** League-average batted-ball rates (0–1). */
  gbRate: number;
  fbRate: number;
  ldRate: number;
  /** Directional spray means (0–1). */
  pullRate: number;
  straightawayRate: number;
  oppoRate: number;
  /** Mean Statcast sprint speed (ft/s). */
  sprintSpeed: number;
  computedAt: string;
}

const FALLBACKS = {
  chaseRate: 0.3,
  walkRate: 0.085,
  strikeoutRate: 0.225,
  whiffRate: 0.25,
  ops: 0.728,
  woba: 0.32,
  gbRate: 0.44,
  fbRate: 0.33,
  ldRate: 0.23,
  pullRate: 0.39,
  straightawayRate: 0.34,
  oppoRate: 0.27,
  sprintSpeed: 27,
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

/** Normalize Savant percent columns to a 0–1 rate. */
function columnMeanRate(
  rows: Record<string, string>[],
  ...keys: string[]
): number | null {
  const mean = columnMeanFromKeys(rows, ...keys);
  if (mean === null) return null;
  return mean > 1 ? mean / 100 : mean;
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
 * the daily job — no extra Savant HTTP calls.
 */
export function computeLeagueAveragesFromCsvs(
  disciplineCsv: string,
  expectedStatsCsv: string,
  season: number,
  leagueOps: number | null,
  sprayCsv = "",
  sprintCsv = "",
  computedAt = new Date().toISOString()
): LeagueAveragesSnapshot {
  const disciplineRows = parseCsvToRows(disciplineCsv);
  const expectedRows = parseCsvToRows(expectedStatsCsv);
  const sprayRows = parseCsvToRows(sprayCsv);
  const sprintRows = parseCsvToRows(sprintCsv);

  const chaseRaw = columnMeanFromKeys(disciplineRows, "oz_swing_percent");
  const whiffRaw = columnMeanFromKeys(disciplineRows, "whiff_percent");
  const bbRaw = columnMeanFromKeys(expectedRows, "bb%", "bb_percent");
  const kRaw = columnMeanFromKeys(expectedRows, "k%", "k_percent");
  const wobaRaw = columnMeanFromKeys(expectedRows, "woba", "woba_value");

  const gbRate = columnMeanRate(
    sprayRows,
    "gb_rate",
    "gb_percent",
    "ground_ball_percent",
    "gb"
  );
  const fbRate = columnMeanRate(
    sprayRows,
    "fb_rate",
    "fb_percent",
    "fly_ball_percent",
    "fb"
  );
  const ldRate = columnMeanRate(
    sprayRows,
    "ld_rate",
    "ld_percent",
    "line_drive_percent",
    "ld"
  );
  const pullRate = columnMeanRate(
    sprayRows,
    "pull_rate",
    "pull_percent",
    "pull"
  );
  const straightawayRate = columnMeanRate(
    sprayRows,
    "straight_rate",
    "straightaway_percent",
    "cent"
  );
  const oppoRate = columnMeanRate(
    sprayRows,
    "oppo_rate",
    "oppo_percent",
    "opposite_percent",
    "oppo"
  );

  const sprintRaw = columnMeanFromKeys(sprintRows, "sprint_speed", "speed");

  return {
    season,
    chaseRate: chaseRaw !== null ? chaseRaw / 100 : FALLBACKS.chaseRate,
    walkRate: bbRaw !== null ? bbRaw / 100 : FALLBACKS.walkRate,
    strikeoutRate: kRaw !== null ? kRaw / 100 : FALLBACKS.strikeoutRate,
    whiffRate: whiffRaw !== null ? whiffRaw / 100 : FALLBACKS.whiffRate,
    ops: leagueOps ?? FALLBACKS.ops,
    woba: wobaRaw ?? FALLBACKS.woba,
    gbRate: gbRate ?? FALLBACKS.gbRate,
    fbRate: fbRate ?? FALLBACKS.fbRate,
    ldRate: ldRate ?? FALLBACKS.ldRate,
    pullRate: pullRate ?? FALLBACKS.pullRate,
    straightawayRate: straightawayRate ?? FALLBACKS.straightawayRate,
    oppoRate: oppoRate ?? FALLBACKS.oppoRate,
    sprintSpeed: sprintRaw ?? FALLBACKS.sprintSpeed,
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
    spray?: (season: number) => Promise<string>;
    sprint?: (season: number) => Promise<string>;
  }
): Promise<LeagueAveragesSnapshot> {
  const [disciplineCsv, expectedCsv, sprayCsv, sprintCsv, leagueOps] =
    await Promise.all([
      fetchCsv.discipline(year),
      fetchCsv.expected(year),
      fetchCsv.spray?.(year) ?? Promise.resolve(""),
      fetchCsv.sprint?.(year) ?? Promise.resolve(""),
      fetchLeagueOps(year),
    ]);

  return computeLeagueAveragesFromCsvs(
    disciplineCsv,
    expectedCsv,
    year,
    leagueOps,
    sprayCsv,
    sprintCsv
  );
}
