/**
 * Baserunning Context Multiplier
 *
 * Adjusts the RE delta when a successful challenge produces a walk (3-ball count),
 * using Statcast sprint speed and lead-runner bottleneck logic on forced advances.
 *
 * Non-walk success paths (count-only improvement) return 1.0× — base/out RE
 * already captures leverage without runner identity.
 *
 * Bottleneck rule: a trailing runner's speed cannot inflate value beyond the
 * lead runner on the same path (min speed on shared advancement paths).
 */

import { GameStateContext } from "../domain/gameContext.types";
import { BaserunningContextInput } from "../domain/baserunningContext.types";
import { BASEBALL_RULES, BASERUNNING, EXPLANATION } from "../constants";
import { clamp } from "../utils/clamp";

export interface BaserunningContextResult {
  multiplier: number;
  /** Whether sprint speed data contributed to the adjustment. */
  dataAvailable: boolean;
  /** True when the walk-path adjustment was evaluated. */
  walkPath: boolean;
  /** Human-readable note for explanation builder. */
  note: "fast_lead" | "slow_lead" | "fast_batter" | "slow_batter" | null;
}

export function computeBaserunningContext(
  gameState: GameStateContext,
  baserunning: BaserunningContextInput | undefined,
  leagueAvgSprintSpeed: number = BASERUNNING.LEAGUE_AVG_SPRINT_SPEED
): BaserunningContextResult {
  const noData: BaserunningContextResult = {
    multiplier: 1.0,
    dataAvailable: false,
    walkPath: false,
    note: null,
  };

  if (gameState.balls !== BASEBALL_RULES.BALLS_FOR_WALK || !baserunning) {
    return noData;
  }

  const slots = walkAdvanceSlots(
    {
      first: gameState.runnerOnFirst,
      second: gameState.runnerOnSecond,
      third: gameState.runnerOnThird,
    },
    baserunning
  );

  const known = slots.filter((s) => s.effectiveSpeed !== null);
  if (known.length === 0) {
    return { multiplier: 1.0, dataAvailable: false, walkPath: true, note: null };
  }

  const totalWeight = known.reduce((sum, s) => sum + s.weight, 0);
  const weightedMult = known.reduce(
    (sum, s) => sum + speedToMultiplier(s.effectiveSpeed!, leagueAvgSprintSpeed) * s.weight,
    0
  ) / totalWeight;

  const multiplier = clamp(
    weightedMult,
    BASERUNNING.MIN_MULTIPLIER,
    BASERUNNING.MAX_MULTIPLIER
  );

  return {
    multiplier,
    dataAvailable: true,
    walkPath: true,
    note: describeNote(slots, baserunning, multiplier),
  };
}

// ---------------------------------------------------------------------------
// Walk advance slots
// ---------------------------------------------------------------------------

interface AdvanceSlot {
  weight: number;
  effectiveSpeed: number | null;
  label: string;
}

function walkAdvanceSlots(
  runners: { first: boolean; second: boolean; third: boolean },
  ctx: BaserunningContextInput
): AdvanceSlot[] {
  const speeds = {
    batter: ctx.batterSprintSpeed,
    first: ctx.runnerSprintSpeeds.first ?? null,
    second: ctx.runnerSprintSpeeds.second ?? null,
    third: ctx.runnerSprintSpeeds.third ?? null,
  };

  const slots: AdvanceSlot[] = [];

  slots.push({
    weight: BASERUNNING.WEIGHT_BATTER_TO_FIRST,
    effectiveSpeed: speeds.batter,
    label: "batter",
  });

  if (runners.first) {
    slots.push({
      weight: BASERUNNING.WEIGHT_R1_TO_SECOND,
      effectiveSpeed: bottleneckSpeed(speeds.first, runners.second ? speeds.second : null),
      label: "r1",
    });
  }

  if (runners.first && runners.second) {
    slots.push({
      weight: BASERUNNING.WEIGHT_R2_TO_THIRD,
      effectiveSpeed: bottleneckSpeed(speeds.second, runners.third ? speeds.third : null),
      label: "r2",
    });
  }

  if (runners.first && runners.second && runners.third) {
    slots.push({
      weight: BASERUNNING.WEIGHT_R3_SCORES,
      effectiveSpeed: speeds.third,
      label: "r3",
    });
  }

  return slots;
}

function bottleneckSpeed(mover: number | null, leadAhead: number | null): number | null {
  if (mover === null && leadAhead === null) return null;
  if (mover === null) return leadAhead;
  if (leadAhead === null) return mover;
  return Math.min(mover, leadAhead);
}

function speedToMultiplier(speed: number, leagueAvgSprintSpeed: number): number {
  return clamp(
    1 + (speed - leagueAvgSprintSpeed) * BASERUNNING.SPEED_SCALE,
    BASERUNNING.MIN_MULTIPLIER,
    BASERUNNING.MAX_MULTIPLIER
  );
}

function describeNote(
  slots: AdvanceSlot[],
  ctx: BaserunningContextInput,
  multiplier: number
): BaserunningContextResult["note"] {
  if (Math.abs(multiplier - 1) < EXPLANATION.NEGLIGIBLE_MULTIPLIER_DELTA) return null;

  const leadSlot = slots.find((s) => s.label === "r2" || s.label === "r3");
  if (
    leadSlot &&
    leadSlot.effectiveSpeed !== null &&
    (leadSlot.label === "r2" || leadSlot.label === "r3")
  ) {
    return multiplier > 1 ? "fast_lead" : "slow_lead";
  }

  if (ctx.runnerSprintSpeeds.first && slots.some((s) => s.label === "r1")) {
    return multiplier > 1 ? "fast_lead" : "slow_lead";
  }

  return multiplier > 1 ? "fast_batter" : "slow_batter";
}
