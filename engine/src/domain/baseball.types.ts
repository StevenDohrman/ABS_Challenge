/** Valid ball count before a pitch (0–3). */
export type Balls = 0 | 1 | 2 | 3;

/** Valid strike count before a pitch (0–2). */
export type Strikes = 0 | 1 | 2;

/** Valid out count in a half-inning (0–2). */
export type Outs = 0 | 1 | 2;

export const VALID_BALLS = [0, 1, 2, 3] as const;
export const VALID_STRIKES = [0, 1, 2] as const;
export const VALID_OUTS = [0, 1, 2] as const;

export function isBalls(value: number): value is Balls {
  return Number.isFinite(value) && (VALID_BALLS as readonly number[]).includes(value);
}

export function isStrikes(value: number): value is Strikes {
  return Number.isFinite(value) && (VALID_STRIKES as readonly number[]).includes(value);
}

export function isOuts(value: number): value is Outs {
  return Number.isFinite(value) && (VALID_OUTS as readonly number[]).includes(value);
}

/** Assert a value is a valid ball count for engine input. */
export function toBalls(value: number): Balls {
  if (!Number.isFinite(value) || !Number.isInteger(value) || !isBalls(value)) {
    throw new RangeError(`balls must be 0, 1, 2, or 3, got ${value}`);
  }
  return value;
}

/** Assert a value is a valid strike count for engine input. */
export function toStrikes(value: number): Strikes {
  if (!Number.isFinite(value) || !Number.isInteger(value) || !isStrikes(value)) {
    throw new RangeError(`strikes must be 0, 1, or 2, got ${value}`);
  }
  return value;
}

/** Assert a live-feed outs value is a valid 0–2 count for engine input. */
export function toOuts(value: number): Outs {
  if (!Number.isFinite(value) || !Number.isInteger(value) || !isOuts(value)) {
    throw new RangeError(`outs must be 0, 1, or 2, got ${value}`);
  }
  return value;
}

/** Narrow an untrusted [balls, strikes] pair to branded count types. */
export function toCountState(balls: number, strikes: number): readonly [Balls, Strikes] {
  return [toBalls(balls), toStrikes(strikes)] as const;
}
