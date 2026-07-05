/** Outs at the start of an at-bat are always 0, 1, or 2 (never 3). */
export function normalizeOutsAtAtBatStart(outs: number): number {
  return Math.min(Math.max(0, outs), 2);
}

export function formatBaseState(
  first: boolean,
  second: boolean,
  third: boolean
): string {
  const occupied = [first && "1st", second && "2nd", third && "3rd"].filter(
    Boolean
  ) as string[];

  if (occupied.length === 0) return "Bases empty";
  if (occupied.length === 3) return "Bases loaded";

  const label = occupied.length === 1 ? "Runner on" : "Runners on";
  return `${label} ${occupied.join(" and ")}`;
}

export const RECOMMENDATION_DISPLAY_MESSAGES: Record<string, string> = {
  AUTO_ALLOW: "Challenge — strong case, high expected value",
  ALLOW: "Challenge allowed — positive expected value",
  WARN: "Proceed with caution — marginal expected value",
  DENY: "Do not challenge — expected value too low",
};

/**
 * Build the display message, accounting for challenge availability.
 */
export function buildDisplayMessage(
  recommendation: string,
  challengeAvailable: boolean
): string {
  const base = RECOMMENDATION_DISPLAY_MESSAGES[recommendation] ?? recommendation;
  if (challengeAvailable) return base;

  if (recommendation === "AUTO_ALLOW" || recommendation === "ALLOW") {
    return `Out of challenges — missed opportunity (would be ${recommendation})`;
  }
  if (recommendation === "WARN") {
    return "Out of challenges — marginal call, nothing to spend anyway";
  }
  return "Out of challenges — low-value call, nothing missed";
}
