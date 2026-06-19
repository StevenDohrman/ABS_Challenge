/**
 * Minimal representative CSV fixtures for Savant endpoints.
 * Column names match what the real API returns as of the 2024–2026 seasons.
 */

// ---------------------------------------------------------------------------
// Expected statistics (xStats) leaderboard
// ---------------------------------------------------------------------------

export const EXPECTED_STATS_CSV = [
  "last_name,first_name,player_id,year,pa,bip,ba,xba,slg,xslg,woba,xwoba,xwobacon,wobacon,hit,xhit,barrel_batted_rate,hard_hit_percent,k_percent,bb_percent",
  "Wilson,Jacob,682998,2026,550,400,.285,.291,.462,.448,.348,.352,.410,.405,157,160,9.5,42.0,18.2,9.8",
  "Soto,Juan,665742,2026,620,430,.288,.295,.520,.510,.392,.399,.450,.445,178,182,12.3,47.5,16.1,18.4",
  // Row with missing optional fields to test null handling
  "Doe,Jane,999001,2026,50,30,.200,,0.300,,0.280,,,,,,,,,",
].join("\n");

// ---------------------------------------------------------------------------
// Plate discipline leaderboard (custom endpoint)
// ---------------------------------------------------------------------------

export const PLATE_DISCIPLINE_CSV = [
  "player_id,player_name,year,pa,exit_velocity_avg,launch_angle_avg,sweet_spot_percent,oz_swing_percent,whiff_percent,z_swing_percent",
  "682998,Jacob Wilson,2026,550,91.2,12.5,31.0,24.5,19.8,68.2",
  "665742,Juan Soto,2026,620,93.4,15.8,35.2,16.2,17.3,72.1",
  // Player only in discipline CSV (should be ignored since they're not in xStats)
  "888001,Unknown Player,2026,200,88.0,10.0,28.0,30.0,25.0,60.0",
].join("\n");

// ---------------------------------------------------------------------------
// Spray profile leaderboard
// ---------------------------------------------------------------------------

export const SPRAY_PROFILE_CSV = [
  "player_id,player_name,year,pa,pull_percent,straightaway_percent,oppo_percent,gb_percent,fb_percent,ld_percent",
  "682998,Jacob Wilson,2026,550,41.2,34.8,24.0,45.1,31.2,23.7",
  "665742,Juan Soto,2026,620,36.5,38.2,25.3,38.4,37.0,24.6",
  // Row with empty spray fields
  "999002,Empty Player,2026,105,,,,,,,",
].join("\n");

// ---------------------------------------------------------------------------
// Fielder OAA leaderboard
// ---------------------------------------------------------------------------

export const FIELDER_OAA_CSV = [
  "player_id,name,year,pos,outs_above_average,outs_above_average_rhh,outs_above_average_lhh",
  "682998,Jacob Wilson,2026,CF,8,5,3",
  "641355,Steven Kwan,2026,LF,12,7,5",
  "545361,Mike Trout,2026,CF,3,1,2",
  // Row with null OAA
  "999003,New Fielder,2026,RF,,,-1",
].join("\n");

// ---------------------------------------------------------------------------
// CSV edge cases
// ---------------------------------------------------------------------------

/** CSV with BOM prefix */
export const BOM_CSV =
  "\uFEFFplayer_id,name,year,pos,outs_above_average,outs_above_average_rhh,outs_above_average_lhh\n" +
  "682998,Jacob Wilson,2026,CF,8,5,3\n";

/** CSV with quoted field containing a comma */
export const QUOTED_FIELD_CSV = [
  "player_id,player_name,year,pa,pull_percent,straightaway_percent,oppo_percent,gb_percent,fb_percent,ld_percent",
  '682998,"Wilson, Jacob",2026,550,41.2,34.8,24.0,45.1,31.2,23.7',
].join("\n");

/** CSV with only a header row (no data) */
export const HEADER_ONLY_CSV =
  "player_id,name,year,pos,outs_above_average,outs_above_average_rhh,outs_above_average_lhh\n";

/** Completely empty CSV */
export const EMPTY_CSV = "";

// ---------------------------------------------------------------------------
// Outfield directional OAA leaderboard
// ---------------------------------------------------------------------------

export const OUTFIELD_DIRECTIONAL_OAA_CSV = [
  "player_id,name,year,pos,outs_above_average,outs_above_average_left,outs_above_average_straight,outs_above_average_right,reaction,burst,route",
  "682998,Jacob Wilson,2026,CF,8,3,2,3,0.32,1.8,95.4",
  "641355,Steven Kwan,2026,LF,12,5,4,3,0.28,2.1,97.2",
  // Row with missing jump metrics
  "545361,Mike Trout,2026,CF,3,1,1,1,,,",
].join("\n");

// ---------------------------------------------------------------------------
// Sprint speed leaderboard
// ---------------------------------------------------------------------------

export const SPRINT_SPEED_CSV = [
  "player_id,player_name,year,pos,sprint_speed,hp_to_1b,competitive_runs",
  "682998,Jacob Wilson,2026,CF,29.8,4.12,42",
  "641355,Steven Kwan,2026,LF,28.4,4.23,38",
  // Row with missing speed
  "999004,Slow Player,2026,1B,,4.85,12",
].join("\n");

// ---------------------------------------------------------------------------
// Per-player Statcast pitch history (statcast_search/csv)
// ---------------------------------------------------------------------------

export const PLAYER_STATCAST_HISTORY_CSV = [
  "game_pk,game_date,game_year,batter,pitcher,at_bat_number,pitch_number,pitch_type,release_speed,balls,strikes,outs_when_up,inning,stand,p_throws,type,description,events,plate_x,plate_z,sz_top,sz_bot,zone",
  // Called strike on 0-0 count, RHH vs LHP, in zone
  "824991,2026-06-17,2026,682998,656731,1,1,FF,95.4,0,0,1,9,R,L,S,called_strike,,0.12,2.45,3.50,1.60,2",
  // Ball on 0-1, slightly outside
  "824991,2026-06-17,2026,682998,656731,1,2,SL,87.2,1,1,1,9,R,L,B,ball,,0.95,2.10,3.50,1.60,13",
  // In-play terminal pitch (strikeout swinging)
  "824991,2026-06-17,2026,682998,656731,1,3,CH,82.1,1,2,1,9,R,L,S,swinging_strike,strikeout,0.18,2.80,3.50,1.60,8",
  // Different game
  "824800,2026-06-15,2026,682998,500871,5,1,FF,93.1,0,0,0,3,R,R,B,ball,,-0.82,2.20,3.45,1.55,11",
].join("\n");

/** Savant returns an empty CSV when no pitches are found for the player/season. */
export const EMPTY_PLAYER_HISTORY_CSV =
  "game_pk,game_date,game_year,batter,pitcher,at_bat_number,pitch_number,pitch_type,release_speed,balls,strikes,outs_when_up,inning,stand,p_throws,type,description,events,plate_x,plate_z,sz_top,sz_bot,zone\n";
