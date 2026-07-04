import { LeagueAverages } from "../domain/leagueContext.types";
import { LineupContextInput } from "../domain/lineupContext.types";
import { Outs } from "../domain/baseball.types";
import { LINEUP } from "../constants";
import { scaleMultiplier } from "../utils/clamp";
import { OPS_TO_WOBA_SCALE } from "../utils/conversion";

export interface LineupContextResult {
  multiplier: number;
  dataAvailable: boolean;
  strongUpcoming: boolean;
}

export function computeLineupContext(
  lineup: LineupContextInput | undefined,
  league: LeagueAverages
): LineupContextResult {
  if (!lineup?.dueUpBatters.length) {
    return { multiplier: 1.0, dataAvailable: false, strongUpcoming: false };
  }

  const leagueWoba = league.woba;
  let weightedSum = 0;
  let weightSum = 0;

  for (let i = 0; i < lineup.dueUpBatters.length; i++) {
    const quality = resolveQuality(lineup.dueUpBatters[i]);
    if (quality === null) continue;

    const decay = LINEUP.SLOT_DECAY[i] ?? LINEUP.SLOT_DECAY[LINEUP.SLOT_DECAY.length - 1];
    weightedSum += quality * decay;
    weightSum += decay;
  }

  if (weightSum === 0) {
    return { multiplier: 1.0, dataAvailable: false, strongUpcoming: false };
  }

  const weightedQuality = weightedSum / weightSum;
  const deviation = weightedQuality - leagueWoba;

  const multiplier = scaleMultiplier(
    deviation,
    LINEUP.WOBA_SCALE,
    LINEUP.MIN_MULTIPLIER,
    LINEUP.MAX_MULTIPLIER
  );

  return {
    multiplier,
    dataAvailable: true,
    strongUpcoming: weightedQuality > leagueWoba + 0.03,
  };
}

function resolveQuality(batter: { ops: number | null; woba: number | null }): number | null {
  if (batter.woba !== null && Number.isFinite(batter.woba)) return batter.woba;
  if (batter.ops !== null && Number.isFinite(batter.ops)) {
    return batter.ops / OPS_TO_WOBA_SCALE;
  }
  return null;
}

/**
 * Build the due-up batter window from a batting order and current spot.
 * Exported for backend precompute and unit tests.
 */
export function buildDueUpWindow(
  battingOrder: number[],
  currentBatterId: number,
  outs: Outs
): number[] {
  const windowSize = Math.max(1, LINEUP.WINDOW_BASE - outs);
  const currentIndex = battingOrder.indexOf(currentBatterId);
  if (currentIndex === -1) return [];

  return battingOrder.slice(currentIndex + 1, currentIndex + 1 + windowSize);
}
