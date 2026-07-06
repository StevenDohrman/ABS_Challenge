/** Ordinal suffix only: 1 → "st", 2 → "nd", 5 → "th". */
export function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

/** Full ordinal label: 5 → "5th". */
export function formatOrdinal(n: number): string {
  return `${n}${ordinalSuffix(n)}`;
}

/**
 * Inning-half arrow for display.
 * @param strict When true, only "Top"/"Bot" get arrows (empty otherwise).
 */
export function inningHalfArrow(half: string | null | undefined, strict = false): string {
  if (half === "Top") return "▲";
  if (half === "Bot") return "▼";
  if (strict) return "";
  return half ? "▼" : "";
}

/** e.g. "▲ 5th" */
export function formatHalfInning(half: string, inning: number): string {
  return `${inningHalfArrow(half)} ${formatOrdinal(inning)}`;
}

/** e.g. "▲ 5" (no ordinal) — used in live situation strips. */
export function formatInningShort(half: string | null | undefined, inning: number | null): string {
  if (inning === null) return "";
  const arrow = inningHalfArrow(half);
  return arrow ? `${arrow}\u00a0${inning}` : String(inning);
}

/** Fallback when API abbrev is empty. */
export function teamAbbrev(abbrev: string, teamName: string): string {
  return abbrev || teamName.slice(0, 3).toUpperCase();
}
