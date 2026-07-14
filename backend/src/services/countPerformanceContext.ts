import {
  effectiveCountWoba,
  type PlayerCountPerformanceMap,
} from "@abs/data-pipeline";

/** Build batter wOBA-by-count map for RE scaling (null when no usable buckets). */
export function buildBatterWobaByCount(
  buckets: PlayerCountPerformanceMap | null
): Record<string, number> | null {
  if (!buckets) return null;

  const result: Record<string, number> = {};
  for (const [key, bucket] of Object.entries(buckets)) {
    const woba = effectiveCountWoba(bucket);
    if (woba != null) {
      result[key] = woba;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
