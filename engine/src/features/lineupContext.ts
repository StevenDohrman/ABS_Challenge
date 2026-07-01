/**
 * Lineup Context Multiplier
 *
 * Weights how valuable it is to extend this half-inning based on the quality
 * of upcoming batters in a sliding window keyed to outs remaining.
 *
 * Window size: 5 - outs (e.g. 2 outs → current spot + next 2 on-deck = 3 slots
 * from the on-deck position). The current batter is excluded — offensiveValue
 * already scales for them. On a 3-ball walk path the window starts at on-deck
 * (same as non-walk) because the backend builds dueUpBatters from idx + 1.
 */

import { LeagueAverages } from "../domain/leagueContext.types";
import { LineupContextInput } from "../domain/lineupContext.types";
import { LINEUP } from "../constants";

const OBP_TO_WOBA_SCALE = 1.8;

export interface LineupContextResult {
  multiplier: number;
  dataAvailable: boolean;
  /** True when the upcoming queue is notably above average. */
  strongUpcoming: boolean;
}

export function computeLineupContext(
  lineup: LineupContextInput | undefined,
  league: LeagueAverages
): LineupContextResult {
  if (!lineup?.dueUpBatters.length) {
    return { multiplier: 1.0, dataAvailable: false, strongUpcoming: false };
  }

  const leagueWoba = league.woba ?? LINEUP.LEAGUE_AVG_WOBA;
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
  const rawMultiplier = 1 + deviation * LINEUP.WOBA_SCALE;

  const multiplier = clamp(
    rawMultiplier,
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
  if (batter.woba !== null) return batter.woba;
  if (batter.ops !== null) return batter.ops / OBP_TO_WOBA_SCALE;
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build the due-up batter window from a batting order and current spot.
 * Exported for backend precompute and unit tests.
 */
export function buildDueUpWindow(
  battingOrder: number[],
  currentBatterId: number,
  outs: number
): number[] {
  const windowSize = Math.max(1, LINEUP.WINDOW_BASE - outs);
  const currentIndex = battingOrder.indexOf(currentBatterId);
  if (currentIndex === -1) return [];

  return battingOrder.slice(currentIndex + 1, currentIndex + 1 + windowSize);
}
