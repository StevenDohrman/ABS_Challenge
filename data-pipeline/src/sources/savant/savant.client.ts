import axios, { AxiosInstance } from "axios";

const SAVANT_BASE = "https://baseballsavant.mlb.com";

/**
 * Shared axios instance for Baseball Savant.
 * @internal Exported for test instrumentation only — use the named functions.
 */
export const savantHttp: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: {
    Accept: "text/csv,text/plain,*/*",
    // Savant occasionally blocks non-browser requests; a browser-like agent avoids that.
    "User-Agent":
      "Mozilla/5.0 (compatible; ABS-Challenge/1.0; +https://github.com/abs-challenge)",
  },
});

/**
 * Fetch the expected-statistics leaderboard CSV for a given season.
 *
 * Provides per-batter: ba, xba, slg, xslg, woba, xwoba, barrel_batted_rate,
 * hard_hit_percent, k_percent, bb_percent.
 */
export async function fetchExpectedStatsCsv(season: number): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/leaderboard/expected_statistics`,
    {
      params: {
        type: "batter",
        year: season,
        position: "",
        team: "",
        min: "q",
        csv: "true",
      },
      responseType: "text",
    }
  );
  return data;
}

/**
 * Fetch the custom batting leaderboard CSV for a given season, selecting
 * plate-discipline columns not available in the expected-statistics endpoint.
 *
 * Provides per-batter: exit_velocity_avg, launch_angle_avg, sweet_spot_percent,
 * oz_swing_percent (chase), whiff_percent, z_swing_percent (zone contact).
 */
export async function fetchPlateDisciplineCsv(season: number): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/leaderboard/custom`,
    {
      params: {
        year: season,
        type: "batter",
        filter: "",
        sort: "4",
        sortDir: "desc",
        min: "q",
        selections: [
          "exit_velocity_avg",
          "launch_angle_avg",
          "sweet_spot_percent",
          "oz_swing_percent",
          "whiff_percent",
          "z_swing_percent",
        ].join(","),
        chart: "false",
        csv: "true",
      },
      responseType: "text",
    }
  );
  return data;
}

/**
 * Fetch the batted-ball spray profile leaderboard CSV for a given season.
 *
 * Provides per-batter: pull_rate, straight_rate, oppo_rate,
 * gb_rate, fb_rate, ld_rate (decimal rates 0–1).
 *
 * NOTE: The endpoint was moved from /leaderboard/batted-ball-profile to
 * /leaderboard/batted-ball and the column names changed accordingly.
 * The parser handles both naming conventions via fallback key lists.
 */
export async function fetchSprayProfileCsv(season: number): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/leaderboard/batted-ball`,
    {
      params: {
        year: season,
        min: "100",
        csv: "true",
      },
      responseType: "text",
    }
  );
  return data;
}

/**
 * Fetch the Outs Above Average fielder leaderboard CSV for a given season.
 *
 * Provides per-fielder: outs_above_average, outs_above_average_rhh,
 * outs_above_average_lhh, and position.
 */
export async function fetchFielderOaaCsv(season: number): Promise<string> {
  // Savant returns the full HTML leaderboard page (not CSV) when pos/range/shift
  // params are included — only the minimal param set reliably returns CSV.
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/leaderboard/outs_above_average`,
    {
      params: {
        year: season,
        type: "Fielder",
        csv: "true",
      },
      responseType: "text",
    }
  );
  if (data.trimStart().startsWith("<!DOCTYPE") || data.trimStart().startsWith("<html")) {
    throw new Error(
      `[savant.client] fetchFielderOaaCsv(${season}) received HTML instead of CSV — ` +
        "Savant may have changed the endpoint params again"
    );
  }
  return data;
}

/**
 * Fetch the sprint speed leaderboard CSV for a given season.
 *
 * Provides per-player: sprint speed (ft/s), home-to-first time,
 * competitive run count, and primary position.
 */
export async function fetchSprintSpeedCsv(season: number): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/sprint_speed_leaderboard`,
    {
      params: {
        year: season,
        type: "top",
        min: "10",
        pos: "all",
        team: "",
        csv: "true",
      },
      responseType: "text",
    }
  );
  return data;
}

/**
 * Fetch pitch-level Statcast history for a single player from the
 * statcast_search CSV endpoint.
 *
 * Called at lineup confirmation time — not as part of the daily bulk job.
 * Fetches only regular-season pitches for the specified player and season.
 *
 * @param playerType - "batter" to get pitches seen; "pitcher" to get pitches thrown.
 */
export async function fetchPlayerStatcastHistoryCsv(
  playerId: number,
  season: number,
  playerType: "batter" | "pitcher" = "batter"
): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/statcast_search/csv`,
    {
      params: {
        all: "true",
        hfGT: "R|",
        hfSea: `${season}|`,
        player_type: playerType,
        player_id: playerId,
        type: "details",
        csv: "true",
      },
      responseType: "text",
    }
  );
  return data;
}

/**
 * Fetch all Statcast pitch rows for a single completed game.
 *
 * Savant typically lags 30–60+ minutes after game end; callers should retry
 * until rows appear.
 */
export async function fetchGameStatcastCsv(gamePk: number): Promise<string> {
  const { data } = await savantHttp.get<string>(
    `${SAVANT_BASE}/statcast_search/csv`,
    {
      params: {
        all: "true",
        type: "details",
        game_pk: gamePk,
        csv: "true",
      },
      responseType: "text",
    }
  );
  if (data.trimStart().startsWith("<!DOCTYPE") || data.trimStart().startsWith("<html")) {
    throw new Error(
      `[savant.client] fetchGameStatcastCsv(${gamePk}) received HTML instead of CSV`
    );
  }
  return data;
}
