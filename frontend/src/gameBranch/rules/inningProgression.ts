import type { BranchDocument, BranchSituation } from "../state/branchTypes";
import { GAME_RULES } from "../../constants/gameRules";

export const OUTS_PER_HALF_INNING = GAME_RULES.OUTS_PER_HALF_INNING;

export function nextHalfInning(
  inning: number,
  half: "top" | "bottom"
): { inning: number; halfInning: "top" | "bottom" } {
  if (half === "top") return { inning, halfInning: "bottom" };
  return { inning: inning + 1, halfInning: "top" };
}

export function nextBatterId(order: number[], currentId: number): number {
  if (order.length === 0) return currentId;
  const idx = order.indexOf(currentId);
  if (idx < 0) return order[0]!;
  return order[(idx + 1) % order.length]!;
}

/** Build situation after the third out — advance to next half-inning. */
export function endHalfInning(doc: BranchDocument, sit: BranchSituation): BranchSituation {
  const { inning, halfInning } = nextHalfInning(sit.inning, sit.halfInning);
  const homeId = doc.schedule.homeTeamId;
  const awayId = doc.schedule.awayTeamId;
  const battingTeamId = halfInning === "top" ? awayId : homeId;
  const fieldingTeamId = halfInning === "top" ? homeId : awayId;
  const battingTeam = battingTeamId === homeId ? doc.teams.home : doc.teams.away;
  const fieldingTeam = fieldingTeamId === homeId ? doc.teams.home : doc.teams.away;

  return {
    ...sit,
    inning,
    halfInning,
    battingTeamId,
    fieldingTeamId,
    outs: 0,
    balls: 0,
    strikes: 0,
    runners: {},
    batterId: battingTeam.battingOrder[0] ?? sit.batterId,
    pitcherId: fieldingTeam.defense.pitcher ?? sit.pitcherId,
  };
}

/** If outs reached 3, roll to the next half-inning. */
export function resolveOuts(
  doc: BranchDocument,
  sit: BranchSituation
): BranchSituation {
  if (sit.outs >= OUTS_PER_HALF_INNING) {
    return endHalfInning(doc, sit);
  }
  return sit;
}
