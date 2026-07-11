import {
  parseCsvToRows,
  parseExpectedStats,
  mergePlateDiscipline,
  parseSprayProfiles,
  parseFielderOaa,
  parseSprintSpeed,
  parsePlayerStatcastHistory,
  parseGameStatcastCsv,
  parsePitchArsenalStats,
  aggregatePitchMixBallRates,
  aggregatePitcherPitchMixFromStatcastHistory,
} from "../savant.parser";
import {
  EXPECTED_STATS_CSV,
  PLATE_DISCIPLINE_CSV,
  SPRAY_PROFILE_CSV,
  FIELDER_OAA_CSV,
  SPRINT_SPEED_CSV,
  PLAYER_STATCAST_HISTORY_CSV,
  EMPTY_PLAYER_HISTORY_CSV,
  PITCH_ARSENAL_STATS_CSV,
  PITCHER_STATCAST_BALL_RATES_CSV,
  BOM_CSV,
  QUOTED_FIELD_CSV,
  HEADER_ONLY_CSV,
  EMPTY_CSV,
} from "./fixtures/savant.fixture";

const FETCHED_AT = "2026-06-18T08:00:00.000Z";

// ---------------------------------------------------------------------------
// parseCsvToRows — generic CSV utilities
// ---------------------------------------------------------------------------

describe("parseCsvToRows", () => {
  it("parses a well-formed CSV into row objects", () => {
    const rows = parseCsvToRows(FIELDER_OAA_CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      player_id: "682998",
      name: "Jacob Wilson",
      pos: "CF",
      outs_above_average: "8",
    });
  });

  it("strips BOM characters from the header row", () => {
    const rows = parseCsvToRows(BOM_CSV);
    expect(rows).toHaveLength(1);
    expect(rows[0].player_id).toBe("682998");
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsvToRows(QUOTED_FIELD_CSV);
    expect(rows[0].player_name).toBe("Wilson, Jacob");
  });

  it("returns empty array for header-only CSV", () => {
    expect(parseCsvToRows(HEADER_ONLY_CSV)).toHaveLength(0);
  });

  it("returns empty array for an empty string", () => {
    expect(parseCsvToRows(EMPTY_CSV)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseExpectedStats
// ---------------------------------------------------------------------------

describe("parseExpectedStats", () => {
  it("parses all rows from the expected-statistics CSV", () => {
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(statlines).toHaveLength(3);
  });

  it("maps playerId correctly", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.playerId).toBe(682998);
  });

  it("assembles playerName from first_name and last_name", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.playerName).toBe("Jacob Wilson");
  });

  it("maps season and pa", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.season).toBe(2026);
    expect(wilson.pa).toBe(550);
  });

  it("maps traditional stats", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.ba).toBeCloseTo(0.285);
    expect(wilson.slg).toBeCloseTo(0.462);
    expect(wilson.woba).toBeCloseTo(0.348);
  });

  it("maps expected stats", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.xba).toBeCloseTo(0.291);
    expect(wilson.xslg).toBeCloseTo(0.448);
    expect(wilson.xwoba).toBeCloseTo(0.352);
  });

  it("maps k_percent and bb_percent", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.kPercent).toBeCloseTo(18.2);
    expect(wilson.bbPercent).toBeCloseTo(9.8);
  });

  it("maps barrel and hard-hit percentages", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.barrelPercent).toBeCloseTo(9.5);
    expect(wilson.hardHitPercent).toBeCloseTo(42.0);
  });

  it("sets plate-discipline fields to null before merge", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.chasePercent).toBeNull();
    expect(wilson.whiffPercent).toBeNull();
    expect(wilson.zonePercent).toBeNull();
  });

  it("sets numeric fields to null when the CSV value is empty", () => {
    // Third row has most fields empty
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    const doe = statlines[2];
    expect(doe.xba).toBeNull();
    expect(doe.xslg).toBeNull();
  });

  it("preserves the raw CSV row", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.raw.player_id).toBe("682998");
  });

  it("sets fetchedAt to the provided timestamp", () => {
    const [wilson] = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    expect(wilson.fetchedAt).toBe(FETCHED_AT);
  });
});

// ---------------------------------------------------------------------------
// mergePlateDiscipline
// ---------------------------------------------------------------------------

describe("mergePlateDiscipline", () => {
  it("merges plate-discipline columns into matching statlines", () => {
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    const merged = mergePlateDiscipline(statlines, PLATE_DISCIPLINE_CSV);

    const wilson = merged.find((s) => s.playerId === 682998)!;
    expect(wilson.chasePercent).toBeCloseTo(24.5);
    expect(wilson.whiffPercent).toBeCloseTo(19.8);
    expect(wilson.zonePercent).toBeCloseTo(68.2);
    expect(wilson.avgExitVelocity).toBeCloseTo(91.2);
    expect(wilson.avgLaunchAngle).toBeCloseTo(12.5);
    expect(wilson.sweetSpotPercent).toBeCloseTo(31.0);
  });

  it("leaves statlines without a matching discipline row unchanged", () => {
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    const doe = statlines[2]; // player_id 999001 not in PLATE_DISCIPLINE_CSV
    const merged = mergePlateDiscipline(statlines, PLATE_DISCIPLINE_CSV);
    const mergedDoe = merged.find((s) => s.playerId === 999001)!;

    expect(mergedDoe.chasePercent).toBeNull();
    expect(mergedDoe.xba).toBe(doe.xba); // original fields untouched
  });

  it("ignores discipline rows that have no matching statline", () => {
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    const merged = mergePlateDiscipline(statlines, PLATE_DISCIPLINE_CSV);

    // player 888001 is in PLATE_DISCIPLINE_CSV but not in EXPECTED_STATS_CSV
    const unknown = merged.find((s) => s.playerId === 888001);
    expect(unknown).toBeUndefined();
    expect(merged).toHaveLength(statlines.length);
  });

  it("does not mutate the original statline array", () => {
    const statlines = parseExpectedStats(EXPECTED_STATS_CSV, FETCHED_AT);
    mergePlateDiscipline(statlines, PLATE_DISCIPLINE_CSV);
    expect(statlines[0].chasePercent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseSprayProfiles
// ---------------------------------------------------------------------------

describe("parseSprayProfiles", () => {
  it("parses all rows", () => {
    expect(parseSprayProfiles(SPRAY_PROFILE_CSV, FETCHED_AT)).toHaveLength(3);
  });

  it("maps playerId and playerName", () => {
    const [wilson] = parseSprayProfiles(SPRAY_PROFILE_CSV, FETCHED_AT);
    expect(wilson.playerId).toBe(682998);
    // New /leaderboard/batted-ball endpoint formats names as "Last, First"
    expect(wilson.playerName).toBe("Wilson, Jacob");
  });

  it("maps directional tendencies", () => {
    const [wilson] = parseSprayProfiles(SPRAY_PROFILE_CSV, FETCHED_AT);
    expect(wilson.pullPercent).toBeCloseTo(41.2);
    expect(wilson.straightawayPercent).toBeCloseTo(34.8);
    expect(wilson.oppoPercent).toBeCloseTo(24.0);
  });

  it("maps batted-ball type mix", () => {
    const [wilson] = parseSprayProfiles(SPRAY_PROFILE_CSV, FETCHED_AT);
    expect(wilson.gbPercent).toBeCloseTo(45.1);
    expect(wilson.fbPercent).toBeCloseTo(31.2);
    expect(wilson.ldPercent).toBeCloseTo(23.7);
  });

  it("sets missing spray fields to null", () => {
    const profiles = parseSprayProfiles(SPRAY_PROFILE_CSV, FETCHED_AT);
    const empty = profiles[2]; // 999002 has empty spray fields
    expect(empty.pullPercent).toBeNull();
    expect(empty.gbPercent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseFielderOaa
// ---------------------------------------------------------------------------

describe("parseFielderOaa", () => {
  it("parses all rows", () => {
    expect(parseFielderOaa(FIELDER_OAA_CSV, FETCHED_AT)).toHaveLength(4);
  });

  it("maps playerId, playerName, season, and position", () => {
    const [wilson] = parseFielderOaa(FIELDER_OAA_CSV, FETCHED_AT);
    expect(wilson.playerId).toBe(682998);
    expect(wilson.playerName).toBe("Jacob Wilson");
    expect(wilson.season).toBe(2026);
    expect(wilson.position).toBe("CF");
  });

  it("maps overall OAA and handedness splits", () => {
    const [wilson] = parseFielderOaa(FIELDER_OAA_CSV, FETCHED_AT);
    expect(wilson.oaa).toBe(8);
    expect(wilson.oaaVsRhh).toBe(5);
    expect(wilson.oaaVsLhh).toBe(3);
  });

  it("sets OAA to null when the column is empty", () => {
    const oaaList = parseFielderOaa(FIELDER_OAA_CSV, FETCHED_AT);
    const newFielder = oaaList[3]; // 999003 has empty overall OAA
    expect(newFielder.oaa).toBeNull();
    expect(newFielder.oaaVsLhh).toBe(-1); // value present
  });

  it("handles BOM-prefixed CSV", () => {
    const oaaList = parseFielderOaa(BOM_CSV, FETCHED_AT);
    expect(oaaList).toHaveLength(1);
    expect(oaaList[0].playerId).toBe(682998);
  });

  it("returns empty array for header-only CSV", () => {
    expect(parseFielderOaa(HEADER_ONLY_CSV, FETCHED_AT)).toHaveLength(0);
  });

  it("parses the current Savant CSV column names (primary_pos_formatted, last_name first_name)", () => {
    const csv = [
      '"last_name, first_name","player_id","display_team_name","year","primary_pos_formatted","fielding_runs_prevented","outs_above_average","outs_above_average_rhh","outs_above_average_lhh"',
      '"Abrams, CJ","682928","Nationals","2026","SS","-7",-9,-7,-2',
    ].join("\n");

    const [abrams] = parseFielderOaa(csv, FETCHED_AT);
    expect(abrams.playerId).toBe(682928);
    expect(abrams.playerName).toBe("Abrams, CJ");
    expect(abrams.position).toBe("SS");
    expect(abrams.oaa).toBe(-9);
    expect(abrams.oaaVsRhh).toBe(-7);
    expect(abrams.oaaVsLhh).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// parseSprintSpeed
// ---------------------------------------------------------------------------

describe("parseSprintSpeed", () => {
  it("parses all rows", () => {
    expect(parseSprintSpeed(SPRINT_SPEED_CSV, FETCHED_AT)).toHaveLength(3);
  });

  it("maps playerId, playerName, season, and position", () => {
    const [wilson] = parseSprintSpeed(SPRINT_SPEED_CSV, FETCHED_AT);
    expect(wilson.playerId).toBe(682998);
    expect(wilson.playerName).toBe("Jacob Wilson");
    expect(wilson.season).toBe(2026);
    expect(wilson.position).toBe("CF");
  });

  it("maps sprint speed and home-to-first time", () => {
    const [wilson] = parseSprintSpeed(SPRINT_SPEED_CSV, FETCHED_AT);
    expect(wilson.sprintSpeed).toBeCloseTo(29.8);
    expect(wilson.homeTo1b).toBeCloseTo(4.12);
  });

  it("maps competitive run count", () => {
    const [wilson] = parseSprintSpeed(SPRINT_SPEED_CSV, FETCHED_AT);
    expect(wilson.competitiveRuns).toBe(42);
  });

  it("sets sprintSpeed to null when the value is absent", () => {
    const speeds = parseSprintSpeed(SPRINT_SPEED_CSV, FETCHED_AT);
    const slow = speeds[2];
    expect(slow.sprintSpeed).toBeNull();
    expect(slow.homeTo1b).toBeCloseTo(4.85);
  });
});

// ---------------------------------------------------------------------------
// parsePlayerStatcastHistory
// ---------------------------------------------------------------------------

describe("parsePlayerStatcastHistory", () => {
  it("parses all pitch rows", () => {
    expect(parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT)).toHaveLength(4);
  });

  it("maps gamePk, gameDate, and season", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.gamePk).toBe(824991);
    expect(pitch.gameDate).toBe("2026-06-17");
    expect(pitch.season).toBe(2026);
  });

  it("maps batter and pitcher IDs", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.batterId).toBe(682998);
    expect(pitch.pitcherId).toBe(656731);
  });

  it("maps atBatNumber and pitchNumber", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.atBatNumber).toBe(1);
    expect(pitch.pitchNumber).toBe(1);
  });

  it("maps pitch type and release speed", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.pitchType).toBe("FF");
    expect(pitch.releaseSpeed).toBeCloseTo(95.4);
  });

  it("maps count state", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.balls).toBe(0);
    expect(pitch.strikes).toBe(0);
    expect(pitch.outsWhenUp).toBe(1);
    expect(pitch.inning).toBe(9);
  });

  it("maps batter/pitcher handedness", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.stand).toBe("R");
    expect(pitch.pThrows).toBe("L");
  });

  it("maps pitch type (B/S/X), description, and events", () => {
    const pitches = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitches[0].type).toBe("S");
    expect(pitches[0].description).toBe("called_strike");
    expect(pitches[0].events).toBeNull();      // non-terminal pitch

    expect(pitches[1].type).toBe("B");
    expect(pitches[1].description).toBe("ball");

    expect(pitches[2].type).toBe("S");
    expect(pitches[2].events).toBe("strikeout"); // terminal pitch
  });

  it("maps plate coordinates and strike zone", () => {
    const [pitch] = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitch.plateX).toBeCloseTo(0.12);
    expect(pitch.plateZ).toBeCloseTo(2.45);
    expect(pitch.szTop).toBeCloseTo(3.50);
    expect(pitch.szBot).toBeCloseTo(1.60);
    expect(pitch.zone).toBe(2);
  });

  it("returns empty array for a header-only CSV", () => {
    expect(parsePlayerStatcastHistory(EMPTY_PLAYER_HISTORY_CSV, FETCHED_AT)).toHaveLength(0);
  });

  it("sets fetchedAt on every pitch", () => {
    const pitches = parsePlayerStatcastHistory(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(pitches.every((p) => p.fetchedAt === FETCHED_AT)).toBe(true);
  });
});

describe("parseGameStatcastCsv", () => {
  it("parses game-scoped Statcast CSV into SavantPitchRow objects", () => {
    const rows = parseGameStatcastCsv(PLAYER_STATCAST_HISTORY_CSV, FETCHED_AT);
    expect(rows).toHaveLength(4);
    expect(rows[0].gamePk).toBe(824991);
    expect(rows[0].atBatNumber).toBe(1);
    expect(rows[0].zone).toBe(2);
  });

  it("returns empty array for header-only CSV", () => {
    expect(parseGameStatcastCsv(EMPTY_PLAYER_HISTORY_CSV, FETCHED_AT)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pitcher pitch-mix parsers
// ---------------------------------------------------------------------------

describe("aggregatePitchMixBallRates", () => {
  it("counts balls and strikes per pitcher and pitch type", () => {
    const rates = aggregatePitchMixBallRates(PITCHER_STATCAST_BALL_RATES_CSV);
    const ff = rates.get("592332:FF");
    expect(ff).toMatchObject({ pitchCount: 5, ballCount: 2, strikeCount: 3 });
    const sl = rates.get("592332:SL");
    expect(sl).toMatchObject({ pitchCount: 2, ballCount: 1, strikeCount: 1 });
  });
});

describe("parsePitchArsenalStats", () => {
  it("merges arsenal usage with Statcast ball rates", () => {
    const ballRates = aggregatePitchMixBallRates(PITCHER_STATCAST_BALL_RATES_CSV);
    const mix = parsePitchArsenalStats(
      PITCH_ARSENAL_STATS_CSV,
      ballRates,
      2026,
      FETCHED_AT
    );

    const gausmanFf = mix.find(
      (row) => row.pitcherId === 592332 && row.pitchType === "FF"
    );
    expect(gausmanFf).toMatchObject({
      pitcherName: "Gausman, Kevin",
      pitchTypeName: "4-Seam Fastball",
      pitchCount: 899,
      usageRate: 0.512,
      ballRate: 0.4,
      strikeRate: 0.6,
      season: 2026,
    });
  });

  it("skips low-sample rows in downstream filters but still parses them", () => {
    const ballRates = aggregatePitchMixBallRates(PITCHER_STATCAST_BALL_RATES_CSV);
    const mix = parsePitchArsenalStats(
      PITCH_ARSENAL_STATS_CSV,
      ballRates,
      2026,
      FETCHED_AT
    );
    const changeup = mix.find((row) => row.pitcherId === 777001);
    expect(changeup?.pitchCount).toBe(20);
    expect(changeup?.usageRate).toBe(0.08);
  });
});

describe("aggregatePitcherPitchMixFromStatcastHistory", () => {
  it("builds mix rows from a single-player history CSV", () => {
    const mix = aggregatePitcherPitchMixFromStatcastHistory(
      PLAYER_STATCAST_HISTORY_CSV,
      656731,
      "Test Pitcher",
      2026,
      FETCHED_AT
    );

    expect(mix.length).toBeGreaterThan(0);
    const ff = mix.find((row) => row.pitchType === "FF");
    expect(ff?.pitchCount).toBe(1);
    expect(ff?.usageRate).toBeGreaterThan(0);
  });
});
