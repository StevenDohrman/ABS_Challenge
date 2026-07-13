import type { SavantPlayerPitchHistory } from "./savant.types";

/** Minimum terminal PAs in a count bucket before it is used for RE scaling. */
export const MIN_COUNT_PA = 20;

/** Below full trust but enough to blend wOBA with xwOBA. */
export const MIN_COUNT_PA_BLEND = 8;

export interface CountPerformanceBucket {
  paCount: number;
  woba: number;
  /** Mean estimated wOBA on in-play pitches in bucket; null when none. */
  xwoba: number | null;
}

export type PlayerCountPerformanceMap = Record<string, CountPerformanceBucket>;

interface BucketAccumulator {
  wobaValueSum: number;
  wobaDenomSum: number;
  xwobaSum: number;
  xwobaCount: number;
}

function isValidCount(balls: number, strikes: number): boolean {
  return (
    balls >= 0 &&
    balls <= 3 &&
    strikes >= 0 &&
    strikes <= 2 &&
    !(balls === 3 && strikes === 3)
  );
}

function isTerminalPitch(pitch: SavantPlayerPitchHistory): boolean {
  return pitch.events != null && pitch.events.trim() !== "";
}

/**
 * Roll up terminal plate appearances into wOBA (and optional xwOBA) by count state.
 * Uses balls/strikes on the terminal pitch (count when the PA ended).
 */
export function rollupCountPerformance(
  history: SavantPlayerPitchHistory[]
): PlayerCountPerformanceMap {
  const buckets = new Map<string, BucketAccumulator>();

  for (const pitch of history) {
    if (!isTerminalPitch(pitch)) continue;
    if (!isValidCount(pitch.balls, pitch.strikes)) continue;

    const key = `${pitch.balls}-${pitch.strikes}`;
    const entry = buckets.get(key) ?? {
      wobaValueSum: 0,
      wobaDenomSum: 0,
      xwobaSum: 0,
      xwobaCount: 0,
    };

    const wobaValue = pitch.wobaValue;
    const wobaDenom = pitch.wobaDenom;
    if (wobaValue != null && wobaDenom != null && wobaDenom > 0) {
      entry.wobaValueSum += wobaValue;
      entry.wobaDenomSum += wobaDenom;
    }

    if (pitch.type === "X" && pitch.estimatedWoba != null) {
      entry.xwobaSum += pitch.estimatedWoba;
      entry.xwobaCount += 1;
    }

    buckets.set(key, entry);
  }

  const result: PlayerCountPerformanceMap = {};
  for (const [key, entry] of buckets) {
    if (entry.wobaDenomSum <= 0) continue;

    const paCount = Math.round(entry.wobaDenomSum);
    const woba = entry.wobaValueSum / entry.wobaDenomSum;
    const xwoba =
      entry.xwobaCount > 0 ? entry.xwobaSum / entry.xwobaCount : null;

    result[key] = {
      paCount,
      woba,
      xwoba,
    };
  }

  return result;
}

/** League-level wOBA by count (count key → wOBA). Omits thin buckets. */
export function toLeagueCountWoba(
  map: PlayerCountPerformanceMap,
  minPa: number = MIN_COUNT_PA
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, bucket] of Object.entries(map)) {
    if (bucket.paCount >= minPa) {
      result[key] = bucket.woba;
    }
  }
  return result;
}

/**
 * Effective wOBA for RE scaling: full wOBA when sample is large; blend with xwOBA when thin.
 */
export function effectiveCountWoba(bucket: CountPerformanceBucket): number | null {
  if (bucket.paCount >= MIN_COUNT_PA) {
    return bucket.woba;
  }
  if (bucket.paCount >= MIN_COUNT_PA_BLEND && bucket.xwoba != null) {
    const weight = bucket.paCount / MIN_COUNT_PA;
    return bucket.woba * weight + bucket.xwoba * (1 - weight);
  }
  return null;
}
