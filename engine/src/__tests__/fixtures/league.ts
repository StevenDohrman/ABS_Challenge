import { LEAGUE_AVERAGES, LINEUP, DEFENSIVE, BASERUNNING } from "../../constants";
import { LeagueAverages } from "../../domain/leagueContext.types";

export const defaultLeague: LeagueAverages = {
  chaseRate: LEAGUE_AVERAGES.CHASE_RATE,
  walkRate: LEAGUE_AVERAGES.WALK_RATE,
  strikeoutRate: LEAGUE_AVERAGES.STRIKEOUT_RATE,
  whiffRate: LEAGUE_AVERAGES.WHIFF_RATE,
  ops: LEAGUE_AVERAGES.OPS,
  woba: LINEUP.LEAGUE_AVG_WOBA,
  gbRate: DEFENSIVE.LEAGUE_AVG_GB_RATE,
  fbRate: DEFENSIVE.LEAGUE_AVG_FB_RATE,
  ldRate: DEFENSIVE.LEAGUE_AVG_LD_RATE,
  pullRate: 0.39,
  straightawayRate: 0.34,
  oppoRate: 0.27,
  sprintSpeed: BASERUNNING.LEAGUE_AVG_SPRINT_SPEED,
};
