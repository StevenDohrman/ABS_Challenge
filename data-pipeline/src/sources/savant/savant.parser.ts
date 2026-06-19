import {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantOutfieldDirectionalOaa,
  SavantSprintSpeed,
  SavantPlayerPitchHistory,
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
    .filter((row) => col(row, "player_id") !== "")
    .map((row): SavantBatterSprayProfile => ({
      playerId: parseInt10(col(row, "player_id")),
      playerName: col(row, "player_name", "name"),
      season: parseInt10(col(row, "year")),
      pa: parseInt10(col(row, "pa")),
      pullPercent: parsePercent(
        col(row, "pull_percent", "pull_pct", "pull")
      ),
      straightawayPercent: parsePercent(
        col(row, "straightaway_percent", "straightaway_pct", "cent")
      ),
      oppoPercent: parsePercent(
        col(row, "oppo_percent", "opposite_percent", "oppo_pct", "oppo")
      ),
      gbPercent: parsePercent(
        col(row, "gb_percent", "ground_ball_percent", "gb")
      ),
      fbPercent: parsePercent(
        col(row, "fb_percent", "fly_ball_percent", "fb")
      ),
      ldPercent: parsePercent(
        col(row, "ld_percent", "line_drive_percent", "ld")
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
    .filter((row) => col(row, "player_id") !== "")
    .map((row): SavantFielderOaa => ({
      playerId: parseInt10(col(row, "player_id")),
      playerName: col(row, "name", "player_name"),
      season: parseInt10(col(row, "year")),
      position: col(row, "pos", "position"),
      oaa: parseNum(col(row, "outs_above_average", "oaa")),
      oaaVsRhh: parseNum(col(row, "outs_above_average_rhh", "oaa_rhh")),
      oaaVsLhh: parseNum(col(row, "outs_above_average_lhh", "oaa_lhh")),
      raw: row,
      fetchedAt,
    }));
}

// ---------------------------------------------------------------------------
// Outfield directional OAA parser
// ---------------------------------------------------------------------------

export function parseOutfieldDirectionalOaa(
  csv: string,
  fetchedAt: string
): SavantOutfieldDirectionalOaa[] {
  return parseCsvToRows(csv)
    .filter((row) => col(row, "player_id") !== "")
    .map((row): SavantOutfieldDirectionalOaa => ({
      playerId: parseInt10(col(row, "player_id")),
      playerName: col(row, "name", "player_name"),
      season: parseInt10(col(row, "year")),
      position: col(row, "pos", "position"),
      oaa: parseNum(col(row, "outs_above_average", "oaa")),
      oaaLeft: parseNum(
        col(row, "outs_above_average_left", "oaa_left", "oaa_lft")
      ),
      oaaStraight: parseNum(
        col(row, "outs_above_average_straight", "oaa_straight", "oaa_str")
      ),
      oaaRight: parseNum(
        col(row, "outs_above_average_right", "oaa_right", "oaa_rgt")
      ),
      reaction: parseNum(col(row, "reaction", "reaction_time")),
      burst: parseNum(col(row, "burst", "burst_score")),
      route: parsePercent(col(row, "route", "route_efficiency", "route_eff")),
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
// Per-player Statcast pitch history parser
// ---------------------------------------------------------------------------

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
        raw: row,
        fetchedAt,
      };
    });
}
