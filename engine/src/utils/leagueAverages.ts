import { LeagueAverages } from "../domain/leagueContext.types";
import { LEAGUE_AVERAGES, LINEUP } from "../constants";

/**
 * Merges caller-supplied league averages over compile-time constants.
 * Fields present in `override` take precedence; missing fields fall back to
 * LEAGUE_AVERAGES from constants.
 */
export function resolveLeagueAverages(
  override?: Partial<LeagueAverages>
): LeagueAverages {
  return {
    chaseRate: override?.chaseRate ?? LEAGUE_AVERAGES.CHASE_RATE,
    walkRate: override?.walkRate ?? LEAGUE_AVERAGES.WALK_RATE,
    strikeoutRate: override?.strikeoutRate ?? LEAGUE_AVERAGES.STRIKEOUT_RATE,
    whiffRate: override?.whiffRate ?? LEAGUE_AVERAGES.WHIFF_RATE,
    ops: override?.ops ?? LEAGUE_AVERAGES.OPS,
    woba: override?.woba ?? LINEUP.LEAGUE_AVG_WOBA,
  };
}
