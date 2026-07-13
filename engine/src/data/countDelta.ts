/**
 * Count-state RE delta resolution for challenge run expectancy.
 *
 * League shape comes from compile-time COUNT_DELTA (Tango-calibrated).
 * When batter + league wOBA-by-count are available, scales that delta by
 * batter performance at the count vs league: delta × (batterWoba / leagueWoba).
 */

/** Fallback league wOBA by count (~2020s Statcast) when daily rollup is missing a bucket. */
export const FALLBACK_LEAGUE_WOBA_BY_COUNT: Record<string, number> = {
  "0-0": 0.325,
  "1-0": 0.416,
  "2-0": 0.481,
  "3-0": 0.749,
  "0-1": 0.284,
  "1-1": 0.314,
  "2-1": 0.357,
  "3-1": 0.571,
  "0-2": 0.185,
  "1-2": 0.187,
  "2-2": 0.193,
  "3-2": 0.374,
};

/** Tango-calibrated league RE deltas vs 0-0 (compile-time fallback). */
export const LEAGUE_COUNT_DELTA: Record<string, number> = {
  "0-0": 0.0,
  "1-0": 0.031,
  "2-0": 0.072,
  "3-0": 0.15,
  "0-1": -0.041,
  "1-1": -0.011,
  "2-1": 0.032,
  "3-1": 0.116,
  "0-2": -0.106,
  "1-2": -0.071,
  "2-2": -0.041,
  "3-2": 0.049,
};

export type CountDeltaSource = "fixed" | "batter" | "league";

export interface CountDeltaContext {
  batterWobaByCount?: Record<string, number> | null;
  leagueWobaByCount?: Record<string, number> | null;
}

export interface CountDeltaResult {
  delta: number;
  source: CountDeltaSource;
}

function leagueWobaAt(
  key: string,
  leagueWobaByCount?: Record<string, number> | null
): number | null {
  const fromDaily = leagueWobaByCount?.[key];
  if (fromDaily != null && fromDaily > 0) return fromDaily;
  const fallback = FALLBACK_LEAGUE_WOBA_BY_COUNT[key];
  return fallback != null && fallback > 0 ? fallback : null;
}

/**
 * Resolves additive RE count delta for a balls-strikes state.
 */
export function resolveCountDelta(
  balls: number,
  strikes: number,
  ctx?: CountDeltaContext | null
): CountDeltaResult {
  const key = `${balls}-${strikes}`;
  const fixed = LEAGUE_COUNT_DELTA[key] ?? 0;

  const batterWoba = ctx?.batterWobaByCount?.[key];
  const leagueWoba = leagueWobaAt(key, ctx?.leagueWobaByCount);

  if (
    batterWoba != null &&
    batterWoba > 0 &&
    leagueWoba != null &&
    leagueWoba > 0
  ) {
    return {
      delta: fixed * (batterWoba / leagueWoba),
      source: "batter",
    };
  }

  return { delta: fixed, source: "fixed" };
}

/** Convenience when only the numeric delta is needed. */
export function lookupCountDelta(
  balls: number,
  strikes: number,
  ctx?: CountDeltaContext | null
): number {
  return resolveCountDelta(balls, strikes, ctx).delta;
}
