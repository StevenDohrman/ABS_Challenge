import { LeagueAverages } from "../domain/leagueContext.types";
import { LEAGUE_AVERAGES, LINEUP, DEFENSIVE, BASERUNNING } from "../constants";

/**
 * Merges caller-supplied league averages over compile-time constants.
 * Fields present in `override` take precedence; missing fields fall back to
 * season-calibrated defaults in constants/.
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
    gbRate: override?.gbRate ?? DEFENSIVE.LEAGUE_AVG_GB_RATE,
    fbRate: override?.fbRate ?? DEFENSIVE.LEAGUE_AVG_FB_RATE,
    ldRate: override?.ldRate ?? DEFENSIVE.LEAGUE_AVG_LD_RATE,
    pullRate: override?.pullRate ?? 0.39,
    straightawayRate: override?.straightawayRate ?? 0.34,
    oppoRate: override?.oppoRate ?? 0.27,
    sprintSpeed: override?.sprintSpeed ?? BASERUNNING.LEAGUE_AVG_SPRINT_SPEED,
  };
}
