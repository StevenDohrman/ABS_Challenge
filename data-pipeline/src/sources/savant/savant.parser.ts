import {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantSprintSpeed,
  SavantPlayerPitchHistory,
  SavantPitchRow,
  SavantPitcherPitchMix,
} from "./savant.types";

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into an array of row objects keyed by header name.
 * Handles:
 *   - Quoted fields containing commas or newlines
 *   - BOM characters on the first line (common in Windows-generated CSVs)
 *   - Trailing whitespace on headers and values
 *   - Empty trailing lines
 */
export function parseCsvToRows(csv: string): Record<string, string>[] {
  // Strip BOM if present
  const cleaned = csv.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] ?? "").trim();
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes ("" inside a quoted field)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Column lookup helpers
// ---------------------------------------------------------------------------

/**
 * Read a column value trying multiple possible key names.
 * Savant occasionally renames columns between seasons; listing fallbacks here
 * keeps parsers resilient without requiring a coordinated update.
 */
function col(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

/** Parse a percentage that Savant may emit as "12.3" or "0.123". */
function parsePercent(raw: string): number | null {
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  // Savant sometimes returns decimals (0.123) and sometimes whole numbers (12.3).
  // Values ≤ 1 are almost certainly decimal fractions — convert to percent.
  return n <= 1 ? n * 100 : n;
}

function parseNum(raw: string): number | null {
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function parseInt10(raw: string): number {
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Batter expected-statistics parser
// ---------------------------------------------------------------------------

/**
 * Parse the expected_statistics leaderboard CSV into batter statlines.
 * Merges gracefully with plate-discipline data via `mergePlateDiscipline`.
 */
export function parseExpectedStats(
  csv: string,
  fetchedAt: string
): SavantBatterStatline[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "player_id") !== "")
    .map((row): SavantBatterStatline => {
      const lastName = col(row, "last_name", "last_name,");
      const firstName = col(row, "first_name");
      const playerName = firstName
        ? `${firstName} ${lastName}`
        : col(row, "player_name", "name", lastName);

      return {
        playerId: parseInt10(col(row, "player_id")),
        playerName,
        season: parseInt10(col(row, "year")),
        pa: parseInt10(col(row, "pa")),
        ba: parseNum(col(row, "ba")),
        slg: parseNum(col(row, "slg")),
        woba: parseNum(col(row, "woba")),
        kPercent: parsePercent(col(row, "k_percent")),
        bbPercent: parsePercent(col(row, "bb_percent")),
        xba: parseNum(col(row, "xba")),
        xslg: parseNum(col(row, "xslg")),
        xwoba: parseNum(col(row, "xwoba")),
        hardHitPercent: parsePercent(
          col(row, "hard_hit_percent", "hard_hit_pct")
        ),
        barrelPercent: parsePercent(
          col(row, "barrel_batted_rate", "barrel_rate", "barrel_pct")
        ),
        // Fields below come from the plate-discipline endpoint.
        // They are null here and populated via mergePlateDiscipline().
        avgExitVelocity: null,
        avgLaunchAngle: null,
        sweetSpotPercent: null,
        chasePercent: null,
        whiffPercent: null,
        zonePercent: null,
        raw: row,
        fetchedAt,
      };
    });
}

// ---------------------------------------------------------------------------
// Plate-discipline merger
// ---------------------------------------------------------------------------

/**
 * Parse the custom plate-discipline leaderboard CSV and merge its metrics
 * into an existing array of batter statlines (matched by playerId).
 *
 * Returns a new array; the original statlines are not mutated.
 */
export function mergePlateDiscipline(
  statlines: SavantBatterStatline[],
  csv: string
): SavantBatterStatline[] {
  const disciplineByPlayer = new Map<number, Record<string, string>>();

  for (const row of parseCsvToRows(csv)) {
    const id = parseInt10(col(row, "player_id"));
    if (id !== 0) disciplineByPlayer.set(id, row);
  }

  return statlines.map((statline) => {
    const row = disciplineByPlayer.get(statline.playerId);
    if (!row) return statline;

    return {
      ...statline,
      avgExitVelocity: parseNum(
        col(row, "exit_velocity_avg", "avg_exit_velocity")
      ),
      avgLaunchAngle: parseNum(
        col(row, "launch_angle_avg", "avg_launch_angle")
      ),
      sweetSpotPercent: parsePercent(
        col(row, "sweet_spot_percent", "sweet_spot_pct")
      ),
      chasePercent: parsePercent(
        col(row, "oz_swing_percent", "chase_percent", "chase_rate")
      ),
      whiffPercent: parsePercent(
        col(row, "whiff_percent", "whiff_pct")
      ),
      zonePercent: parsePercent(
        col(row, "z_swing_percent", "zone_swing_percent")
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Spray profile parser
// ---------------------------------------------------------------------------

export function parseSprayProfiles(
  csv: string,
  fetchedAt: string
): SavantBatterSprayProfile[] {
  return parseCsvToRows(csv)
    // "id" is the column name used by the /leaderboard/batted-ball endpoint;
    // older fixtures and any future API revision may use "player_id".
    .filter((row) => col(row, "player_id", "id") !== "")
    .map((row): SavantBatterSprayProfile => ({
      playerId: parseInt10(col(row, "player_id", "id")),
      playerName: col(row, "player_name", "name"),
      season: parseInt10(col(row, "year")),
      // /leaderboard/batted-ball uses "bbe" (batted-ball events); older
      // endpoint used "pa".
      pa: parseInt10(col(row, "pa", "bbe")),
      // The /leaderboard/batted-ball endpoint returns decimal rates (0–1)
      // with the suffix "_rate"; older endpoint used "_percent" (0–100).
      // parsePercent() normalises both by converting values ≤1 to percentages.
      pullPercent: parsePercent(
        col(row, "pull_percent", "pull_pct", "pull", "pull_rate")
      ),
      straightawayPercent: parsePercent(
        col(row, "straightaway_percent", "straightaway_pct", "cent", "straight_rate")
      ),
      oppoPercent: parsePercent(
        col(row, "oppo_percent", "opposite_percent", "oppo_pct", "oppo", "oppo_rate")
      ),
      gbPercent: parsePercent(
        col(row, "gb_percent", "ground_ball_percent", "gb", "gb_rate")
      ),
      fbPercent: parsePercent(
        col(row, "fb_percent", "fly_ball_percent", "fb", "fb_rate")
      ),
      ldPercent: parsePercent(
        col(row, "ld_percent", "line_drive_percent", "ld", "ld_rate")
      ),
      raw: row,
      fetchedAt,
    }));
}

// ---------------------------------------------------------------------------
// Fielder OAA parser
// ---------------------------------------------------------------------------

export function parseFielderOaa(
  csv: string,
  fetchedAt: string
): SavantFielderOaa[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "player_id", "id") !== "")
    .map((row): SavantFielderOaa => ({
      playerId: parseInt10(col(row, "player_id", "id")),
      playerName: col(
        row,
        "name",
        "player_name",
        "last_name, first_name",
        "last_name_first_name"
      ),
      season: parseInt10(col(row, "year")),
      position: col(row, "pos", "position", "primary_pos_formatted"),
      oaa: parseNum(col(row, "outs_above_average", "oaa")),
      oaaVsRhh: parseNum(col(row, "outs_above_average_rhh", "oaa_rhh")),
      oaaVsLhh: parseNum(col(row, "outs_above_average_lhh", "oaa_lhh")),
      raw: row,
      fetchedAt,
    }));
}

// ---------------------------------------------------------------------------
// Sprint speed parser
// ---------------------------------------------------------------------------

export function parseSprintSpeed(
  csv: string,
  fetchedAt: string
): SavantSprintSpeed[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "player_id") !== "")
    .map((row): SavantSprintSpeed => ({
      playerId: parseInt10(col(row, "player_id")),
      playerName: col(row, "player_name", "name"),
      season: parseInt10(col(row, "year")),
      position: col(row, "pos", "position"),
      sprintSpeed: parseNum(col(row, "sprint_speed", "speed")),
      homeTo1b: parseNum(col(row, "hp_to_1b", "home_to_1b")),
      competitiveRuns: parseInt10(
        col(row, "competitive_runs", "n_competitive_runs", "runs")
      ),
      raw: row,
      fetchedAt,
    }));
}

// ---------------------------------------------------------------------------
// Pitcher pitch-mix parsers
// ---------------------------------------------------------------------------

export interface PitchMixBallRateKey {
  pitcherId: number;
  pitchType: string;
}

export interface PitchMixBallRateStats {
  pitchCount: number;
  ballCount: number;
  strikeCount: number;
}

function pitchMixKey(pitcherId: number, pitchType: string): string {
  return `${pitcherId}:${pitchType}`;
}

/** Classify a pitch as ball (B), strike (S), or neither (in-play / unknown). */
function classifyPitchOutcome(row: Record<string, string>): "B" | "S" | null {
  const resultType = col(row, "type").toUpperCase();
  if (resultType === "B") return "B";
  if (resultType === "S") return "S";

  const desc = col(row, "description").toLowerCase();
  if (desc === "ball") return "B";
  if (desc.includes("strike")) return "S";

  return null;
}

/**
 * Aggregate per-(pitcher, pitch_type) ball and strike counts from a bulk
 * season Statcast CSV or a single-player history CSV.
 */
export function aggregatePitchMixBallRates(
  csv: string
): Map<string, PitchMixBallRateStats> {
  const stats = new Map<string, PitchMixBallRateStats>();

  for (const row of parseCsvToRows(csv)) {
    const pitcherId = parseInt10(col(row, "pitcher"));
    const pitchType = col(row, "pitch_type");
    if (pitcherId === 0 || pitchType === "") continue;

    const key = pitchMixKey(pitcherId, pitchType);
    const entry = stats.get(key) ?? { pitchCount: 0, ballCount: 0, strikeCount: 0 };
    entry.pitchCount += 1;

    const outcome = classifyPitchOutcome(row);
    if (outcome === "B") entry.ballCount += 1;
    else if (outcome === "S") entry.strikeCount += 1;

    stats.set(key, entry);
  }

  return stats;
}

/**
 * Parse pitch arsenal stats and merge ball/strike rates from Statcast aggregates.
 */
export function parsePitchArsenalStats(
  arsenalCsv: string,
  ballRates: Map<string, PitchMixBallRateStats>,
  season: number,
  fetchedAt: string
): SavantPitcherPitchMix[] {
  return parseCsvToRows(arsenalCsv)
    .filter((row) => col(row, "player_id") !== "" && col(row, "pitch_type") !== "")
    .map((row): SavantPitcherPitchMix => {
      const pitcherId = parseInt10(col(row, "player_id"));
      const pitchType = col(row, "pitch_type");
      const combinedName = col(row, "last_name, first_name");
      const pitcherName = combinedName || col(row, "player_name", "name");

      const pitchCount = parseInt10(col(row, "pitches"));
      const usageRaw = parseNum(col(row, "pitch_usage"));
      const usageRate =
        usageRaw === null ? 0 : usageRaw > 1 ? usageRaw / 100 : usageRaw;

      const rateStats = ballRates.get(pitchMixKey(pitcherId, pitchType));
      const counted = rateStats?.pitchCount ?? 0;
      const ballRate =
        counted > 0 ? rateStats!.ballCount / counted : null;
      const strikeRate =
        counted > 0 ? rateStats!.strikeCount / counted : null;

      return {
        pitcherId,
        pitcherName,
        season: parseInt10(col(row, "year")) || season,
        pitchType,
        pitchTypeName: col(row, "pitch_name", "pitch_type_name") || pitchType,
        usageRate,
        ballRate,
        strikeRate,
        pitchCount: pitchCount > 0 ? pitchCount : counted,
        raw: row,
        fetchedAt,
      };
    });
}

/**
 * Fallback: build pitch mix entirely from per-pitcher Statcast history.
 */
export function aggregatePitcherPitchMixFromStatcastHistory(
  csv: string,
  pitcherId: number,
  pitcherName: string,
  season: number,
  fetchedAt: string
): SavantPitcherPitchMix[] {
  const byType = new Map<
    string,
    {
      pitchTypeName: string;
      pitchCount: number;
      ballCount: number;
      strikeCount: number;
      sampleRow: Record<string, string>;
    }
  >();

  let totalPitches = 0;

  for (const row of parseCsvToRows(csv)) {
    const rowPitcherId = parseInt10(col(row, "pitcher"));
    if (rowPitcherId !== pitcherId) continue;

    const pitchType = col(row, "pitch_type");
    if (pitchType === "") continue;

    totalPitches += 1;
    const entry = byType.get(pitchType) ?? {
      pitchTypeName: col(row, "pitch_name") || pitchType,
      pitchCount: 0,
      ballCount: 0,
      strikeCount: 0,
      sampleRow: row,
    };
    entry.pitchCount += 1;

    const outcome = classifyPitchOutcome(row);
    if (outcome === "B") entry.ballCount += 1;
    else if (outcome === "S") entry.strikeCount += 1;

    byType.set(pitchType, entry);
  }

  if (totalPitches === 0) return [];

  return [...byType.entries()].map(([pitchType, stats]): SavantPitcherPitchMix => ({
    pitcherId,
    pitcherName,
    season,
    pitchType,
    pitchTypeName: stats.pitchTypeName,
    usageRate: stats.pitchCount / totalPitches,
    ballRate: stats.pitchCount > 0 ? stats.ballCount / stats.pitchCount : 0,
    strikeRate:
      stats.pitchCount > 0 ? stats.strikeCount / stats.pitchCount : null,
    pitchCount: stats.pitchCount,
    raw: stats.sampleRow,
    fetchedAt,
  }));
}

// ---------------------------------------------------------------------------
// Per-player Statcast pitch history parser
// ---------------------------------------------------------------------------

function mapStatcastRowToSavantPitchRow(
  row: Record<string, string>,
  fetchedAt: string
): SavantPitchRow {
  const atBatNumber = parseInt10(col(row, "at_bat_number"));
  return {
    gamePk: parseInt10(col(row, "game_pk")),
    gameDate: col(row, "game_date"),
    atBatNumber,
    pitchNumber: parseInt10(col(row, "pitch_number")),
    batterId: parseInt10(col(row, "batter")),
    pitcherId: parseInt10(col(row, "pitcher")),
    plateX: parseNum(col(row, "plate_x")),
    plateZ: parseNum(col(row, "plate_z")),
    szTop: parseNum(col(row, "sz_top")),
    szBot: parseNum(col(row, "sz_bot")),
    description: col(row, "description"),
    zone: parseNum(col(row, "zone")),
    raw: row,
    fetchedAt,
  };
}

/**
 * Parse the statcast_search CSV for a single game into SavantPitchRow objects.
 * Used by SavantPostgameJob after a game goes Final.
 */
export function parseGameStatcastCsv(
  csv: string,
  fetchedAt: string
): SavantPitchRow[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "game_pk") !== "")
    .map((row) => mapStatcastRowToSavantPitchRow(row, fetchedAt));
}

/**
 * Parse the statcast_search CSV for a single player into individual pitches.
 * Rows with no game_pk (e.g. header-only CSVs or empty responses) are skipped.
 */
export function parsePlayerStatcastHistory(
  csv: string,
  fetchedAt: string
): SavantPlayerPitchHistory[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "game_pk") !== "")
    .map((row): SavantPlayerPitchHistory => {
      const rawStand = col(row, "stand");
      const rawPThrows = col(row, "p_throws");
      const rawType = col(row, "type");

      return {
        gamePk: parseInt10(col(row, "game_pk")),
        gameDate: col(row, "game_date"),
        season: parseInt10(col(row, "game_year")),
        batterId: parseInt10(col(row, "batter")),
        pitcherId: parseInt10(col(row, "pitcher")),
        atBatNumber: parseInt10(col(row, "at_bat_number")),
        pitchNumber: parseInt10(col(row, "pitch_number")),
        pitchType: col(row, "pitch_type") || null,
        releaseSpeed: parseNum(col(row, "release_speed")),
        balls: parseInt10(col(row, "balls")),
        strikes: parseInt10(col(row, "strikes")),
        outsWhenUp: parseInt10(col(row, "outs_when_up")),
        inning: parseInt10(col(row, "inning")),
        stand: (rawStand === "L" || rawStand === "R" ? rawStand : null),
        pThrows: (rawPThrows === "L" || rawPThrows === "R" ? rawPThrows : null),
        type: (rawType === "B" || rawType === "S" || rawType === "X" ? rawType : null),
        description: col(row, "description"),
        events: col(row, "events") || null,
        plateX: parseNum(col(row, "plate_x")),
        plateZ: parseNum(col(row, "plate_z")),
        szTop: parseNum(col(row, "sz_top")),
        szBot: parseNum(col(row, "sz_bot")),
        zone: parseNum(col(row, "zone")),
        wobaValue: parseNum(col(row, "woba_value")),
        wobaDenom: parseNum(col(row, "woba_denom")),
        estimatedWoba: parseNum(col(row, "estimated_woba_using_speedangle")),
        raw: row,
        fetchedAt,
      };
    });
}
