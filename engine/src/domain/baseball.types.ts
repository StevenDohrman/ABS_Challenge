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
  return (VALID_BALLS as readonly number[]).includes(value);
}

export function isStrikes(value: number): value is Strikes {
  return (VALID_STRIKES as readonly number[]).includes(value);
}

export function isOuts(value: number): value is Outs {
  return (VALID_OUTS as readonly number[]).includes(value);
}
