/**
 * Run expectancy reference data and lookup helpers.
 *
 * The RE24 table maps each of the 24 base/out states to the average number of
 * runs scored for the rest of the inning. Values are derived from MLB play-by-play
 * data (2010–2015 average, per Tom Tango / "The Book").
 *
 * The count delta table maps each of the 12 count states to an additive
 * adjustment that captures how much a favorable or unfavorable count shifts
 * run expectancy relative to a fresh 0-0 at-bat. These are used when the
 * challenge outcome does NOT produce a terminal result (walk or strikeout) —
 * the at-bat simply continues with a different count.
 *
 * For terminal outcomes, this module computes RE directly:
 *   Walk   → look up RE for the new base state after forced advancement
 *   K (2 strikes + another strike) → RE for outs+1, same bases (or 0 if inning ends)
 *
 * Public API:
 *   lookupBaseRE(outs, runners)                           → number
 *   computeChallengeOutcomeExpectancies(...)              → { current, ifSucceeds, ifFails }
 */

import { BASEBALL_RULES } from "../constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Runners {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface ChallengeOutcomeExpectancies {
  /** RE at the current count and base/out state. */
  current: number;
  /**
   * RE after a successful challenge on a called strike (call overturned to ball).
   * Higher than current RE because the batter gained a favorable count or drew a walk.
   */
  ifSucceeds: number;
  /**
   * RE after a failed challenge on a called strike (call stands as strike).
   * Lower than current RE because the batter is deeper in the count or has struck out.
   */
  ifFails: number;
}

// ---------------------------------------------------------------------------
// RE24 table — base/out state → expected runs for rest of inning
// ---------------------------------------------------------------------------

/**
 * Keys are encoded as `"${outs}-${first ? 1 : 0}${second ? 1 : 0}${third ? 1 : 0}"`.
 * Example: 1 out, runners on 1st and 3rd → "1-101"
 */
const RE24: Record<string, number> = {
  // ── 0 outs ───────────────────────────────────────────────
  "0-000": 0.544,
  "0-100": 0.941,
  "0-010": 1.170,
  "0-001": 1.437,
  "0-110": 1.556,
  "0-101": 1.904,
  "0-011": 2.021,
  "0-111": 2.390,
  // ── 1 out ────────────────────────────────────────────────
  "1-000": 0.291,
  "1-100": 0.562,
  "1-010": 0.721,
  "1-001": 0.994,
  "1-110": 1.000,
  "1-101": 1.270,
  "1-011": 1.448,
  "1-111": 1.631,
  // ── 2 outs ───────────────────────────────────────────────
  "2-000": 0.112,
  "2-100": 0.245,
  "2-010": 0.346,
  "2-001": 0.387,
  "2-110": 0.461,
  "2-101": 0.565,
  "2-011": 0.622,
  "2-111": 0.815,
};

/**
 * Returns the expected runs for the rest of the inning from a given base/out state.
 * Returns 0 if outs >= 3 (inning is over).
 */
export function lookupBaseRE(outs: number, runners: Runners): number {
  if (outs >= BASEBALL_RULES.OUTS_PER_INNING) return 0;
  const key = reKey(outs, runners);
  return RE24[key] ?? 0;
}

// ---------------------------------------------------------------------------
// Count delta table — additive RE adjustment by count
// ---------------------------------------------------------------------------

/**
 * How much the current count shifts run expectancy relative to a 0-0 start.
 *
 * A count of 3-0 adds ~0.150 runs because a walk is imminent.
 * A count of 0-2 subtracts ~0.106 runs because a strikeout is imminent.
 *
 * These deltas are added to the base/out RE to approximate the run expectancy
 * for an at-bat that is continuing with a given count.
 *
 * Source: calibrated from Retrosheet play-by-play data, consistent with
 * Tango's "The Book" count leverage research.
 */
const COUNT_DELTA: Record<string, number> = {
  // balls-strikes: delta
  "0-0": 0.000,
  "1-0": 0.031,
  "2-0": 0.072,
  "3-0": 0.150,
  "0-1": -0.041,
  "1-1": -0.011,
  "2-1": 0.032,
  "3-1": 0.116,
  "0-2": -0.106,
  "1-2": -0.071,
  "2-2": -0.041,
  "3-2": 0.049,
};

function lookupCountDelta(balls: number, strikes: number): number {
  return COUNT_DELTA[`${balls}-${strikes}`] ?? 0;
}

// ---------------------------------------------------------------------------
// Walk advancement
// ---------------------------------------------------------------------------

/**
 * Returns the base state after a walk (batter takes first base).
 * Runners advance only if forced by the walk.
 *
 * Also returns whether a run scored (bases-loaded walk).
 */
function advanceRunnersOnWalk(runners: Runners): {
  newRunners: Runners;
  runScored: boolean;
} {
  const { first, second, third } = runners;

  if (!first) {
    // 1st is empty — only batter moves to 1st, no one else is forced
    return { newRunners: { first: true, second, third }, runScored: false };
  }

  if (!second) {
    // 1st occupied, 2nd empty — batter to 1st, runner on 1st forced to 2nd
    return {
      newRunners: { first: true, second: true, third },
      runScored: false,
    };
  }

  if (!third) {
    // 1st and 2nd occupied, 3rd empty — all three forced to advance
    return {
      newRunners: { first: true, second: true, third: true },
      runScored: false,
    };
  }

  // Bases loaded — everyone forced, runner on 3rd scores
  // Base state stays loaded (batter, runner-from-1st, runner-from-2nd occupy bases)
  return {
    newRunners: { first: true, second: true, third: true },
    runScored: true,
  };
}

// ---------------------------------------------------------------------------
// Terminal outcome RE
// ---------------------------------------------------------------------------

/**
 * Expected runs after the batter draws a walk from the current base/out state.
 * Includes the run that scores on a bases-loaded walk.
 */
function walkRE(outs: number, runners: Runners): number {
  const { newRunners, runScored } = advanceRunnersOnWalk(runners);
  return (runScored ? 1 : 0) + lookupBaseRE(outs, newRunners);
}

/**
 * Expected runs after the batter strikes out from the current base/out state.
 * Returns 0 if this is the third out (inning ends).
 */
function strikeoutRE(outs: number, runners: Runners): number {
  return lookupBaseRE(outs + 1, runners);
}

// ---------------------------------------------------------------------------
// Challenge outcome computation
// ---------------------------------------------------------------------------

/**
 * Computes the three run expectancy values needed by the challenge engine.
 *
 * This function models the two possible outcomes of challenging a called strike:
 *
 *   Success → the call is overturned to a ball.
 *     - If balls was 3: the batter draws a walk.
 *     - Otherwise: the count continues as (balls+1, strikes).
 *
 *   Failure → the challenge is denied, the strike call stands.
 *     - If strikes was 2: the batter strikes out.
 *     - Otherwise: the count continues as (balls, strikes+1).
 *
 * @param outs         Outs in the inning at the time of this pitch (0, 1, or 2).
 * @param ballsBefore  Ball count BEFORE this pitch was thrown.
 * @param strikesBefore Strike count BEFORE this pitch was thrown.
 * @param runners      Which bases are occupied.
 */
export function computeChallengeOutcomeExpectancies(
  outs: number,
  ballsBefore: number,
  strikesBefore: number,
  runners: Runners
): ChallengeOutcomeExpectancies {
  const baseRE = lookupBaseRE(outs, runners);

  const current = baseRE + lookupCountDelta(ballsBefore, strikesBefore);

  // --- Success: called strike overturned to ball ---
  const ifSucceeds: number =
    ballsBefore === BASEBALL_RULES.BALLS_FOR_WALK
      ? walkRE(outs, runners)
      : baseRE + lookupCountDelta(ballsBefore + 1, strikesBefore);

  // --- Failure: challenge denied, strike stands ---
  const ifFails: number =
    strikesBefore === BASEBALL_RULES.STRIKES_FOR_STRIKEOUT
      ? strikeoutRE(outs, runners)
      : baseRE + lookupCountDelta(ballsBefore, strikesBefore + 1);

  return { current, ifSucceeds, ifFails };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function reKey(outs: number, { first, second, third }: Runners): string {
  return `${outs}-${first ? 1 : 0}${second ? 1 : 0}${third ? 1 : 0}`;
}
