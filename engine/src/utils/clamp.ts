/** Clamp a value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Scale a deviation-from-baseline into a multiplier: 1 + deviation × scale,
 * then clamp to [min, max].
 */
export function scaleMultiplier(
  deviation: number,
  scale: number,
  min: number,
  max: number
): number {
  return clamp(1 + deviation * scale, min, max);
}
