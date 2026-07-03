import { LEAGUE_AVERAGES, LINEUP } from "../../constants";
import { LeagueAverages } from "../../domain/leagueContext.types";

export const defaultLeague: LeagueAverages = {
  chaseRate: LEAGUE_AVERAGES.CHASE_RATE,
  walkRate: LEAGUE_AVERAGES.WALK_RATE,
  strikeoutRate: LEAGUE_AVERAGES.STRIKEOUT_RATE,
  whiffRate: LEAGUE_AVERAGES.WHIFF_RATE,
  ops: LEAGUE_AVERAGES.OPS,
  woba: LINEUP.LEAGUE_AVG_WOBA,
};
