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
// Matches the /leaderboard/batted-ball endpoint (column names changed in 2026).
// Values are decimal rates (0–1); parsePercent() normalises them to 0–100.
// ---------------------------------------------------------------------------

export const SPRAY_PROFILE_CSV = [
  '"id","name","year","bbe","pull_rate","straight_rate","oppo_rate","gb_rate","fb_rate","ld_rate"',
  '682998,"Wilson, Jacob",2026,550,0.412,0.348,0.240,0.451,0.312,0.237',
  '665742,"Soto, Juan",2026,620,0.365,0.382,0.253,0.384,0.370,0.246',
  // Row with empty spray fields
  '999002,"Empty Player",2026,105,,,,,',
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
  "game_pk,game_date,game_year,batter,pitcher,at_bat_number,pitch_number,pitch_type,release_speed,balls,strikes,outs_when_up,inning,stand,p_throws,type,description,events,plate_x,plate_z,sz_top,sz_bot,zone,woba_value,woba_denom,estimated_woba_using_speedangle",
  // Called strike on 0-0 count, RHH vs LHP, in zone
  "824991,2026-06-17,2026,682998,656731,1,1,FF,95.4,0,0,1,9,R,L,S,called_strike,,0.12,2.45,3.50,1.60,2,,,",
  // Ball on 0-1, slightly outside
  "824991,2026-06-17,2026,682998,656731,1,2,SL,87.2,1,1,1,9,R,L,B,ball,,0.95,2.10,3.50,1.60,13,,,",
  // In-play terminal pitch (strikeout swinging)
  "824991,2026-06-17,2026,682998,656731,1,3,CH,82.1,1,2,1,9,R,L,S,swinging_strike,strikeout,0.18,2.80,3.50,1.60,8,0,1,",
  // Different game
  "824800,2026-06-15,2026,682998,500871,5,1,FF,93.1,0,0,0,3,R,R,B,ball,,-0.82,2.20,3.45,1.55,11,0.69,1,",
].join("\n");

/** Savant returns an empty CSV when no pitches are found for the player/season. */
export const EMPTY_PLAYER_HISTORY_CSV =
  "game_pk,game_date,game_year,batter,pitcher,at_bat_number,pitch_number,pitch_type,release_speed,balls,strikes,outs_when_up,inning,stand,p_throws,type,description,events,plate_x,plate_z,sz_top,sz_bot,zone,woba_value,woba_denom,estimated_woba_using_speedangle\n";

// ---------------------------------------------------------------------------
// Pitch arsenal stats leaderboard
// ---------------------------------------------------------------------------

export const PITCH_ARSENAL_STATS_CSV = [
  '"last_name, first_name","player_id","team_name_alt","pitch_type","pitch_name","run_value_per_100","run_value","pitches","pitch_usage","pa","ba","slg","woba","whiff_percent","k_percent","put_away","est_ba","est_slg","est_woba","hard_hit_percent"',
  '"Gausman, Kevin",592332,"TOR","FF","4-Seam Fastball",1.3,12,"899",51.2,"251","0.272","0.425","0.331",18,21.1,21.4,"0.269","0.453","0.336",47',
  '"Gausman, Kevin",592332,"TOR","SL","Slider",-0.5,-4,"420",23.9,"251","0.210","0.310","0.260",32,28.0,30.1,"0.220","0.320","0.270",41',
  '"Reliever, Test",777001,"BOS","CH","Changeup",0.1,1,"20",8.0,"40","0.200","0.250","0.220",20,15.0,18.0,"0.210","0.260","0.230",35',
].join("\n");

export const PITCHER_STATCAST_BALL_RATES_CSV = [
  "pitch_type,pitcher,type,description",
  "FF,592332,B,ball",
  "FF,592332,B,ball",
  "FF,592332,S,called_strike",
  "FF,592332,S,called_strike",
  "FF,592332,S,called_strike",
  "SL,592332,B,ball",
  "SL,592332,S,called_strike",
  "CH,777001,B,ball",
].join("\n");
