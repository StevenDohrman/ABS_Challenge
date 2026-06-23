/**
 * Backend DTOs — the shapes the API returns to the frontend.
 *
 * These are deliberately separate from the engine's domain types so the
 * frontend never has to know about MLB API field names or engine internals.
 *
 * All data in these DTOs originates from MLB Live API or Baseball Savant.
 * No user input enters the recommendation system.
 */

import type { ChallengeRecommendation as DbRecommendation } from "@prisma/client";
import type { LiveGameSnapshot } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The payload the frontend receives when polling for the latest challenge
 * recommendation for a game.
 */
export interface ChallengeRecommendationResponseDto {
  gamePk: number;

  /** Count state that triggered this recommendation, e.g. "2-1" (balls-strikes) */
  count: string;
  inning: number;
  /** "Top" or "Bot" for display */
  halfInning: string;
  outs: number;
  /** Human-readable base state, e.g. "Runners on 1st and 2nd" */
  baseState: string;

  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

  /**
   * Minimum confidence threshold the engine recommends before challenging.
   * Displayed to fans as context: "challenge if you are at least X% sure."
   * This is purely informational — no user input is collected.
   */
  minimumConfidenceThreshold: number;

  expectedValue: number;
  score: number;

  /** Primary display message derived from the recommendation label */
  displayMessage: string;
  /** Ordered explanation sentences from the engine */
  reasons: string[];

  /** ISO timestamp when this recommendation was triggered by a pitch event */
  triggeredAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATION_DISPLAY_MESSAGES: Record<string, string> = {
  AUTO_ALLOW: "Challenge — strong case, high expected value",
  ALLOW: "Challenge allowed — positive expected value",
  WARN: "Proceed with caution — marginal expected value",
  DENY: "Do not challenge — expected value too low",
};

/**
 * Build the frontend-facing DTO from DB rows.
 */
export function toRecommendationDto(
  rec: DbRecommendation,
  snapshot: LiveGameSnapshot
): ChallengeRecommendationResponseDto {
  const explanations = Array.isArray(rec.explanationJson)
    ? (rec.explanationJson as string[])
    : [];

  return {
    gamePk: rec.gamePk,
    count: `${rec.balls}-${rec.strikes}`,
    inning: snapshot.inning,
    halfInning: snapshot.halfInning === "top" ? "Top" : "Bot",
    outs: snapshot.outs,
    baseState: formatBaseState(
      snapshot.runnerOnFirst,
      snapshot.runnerOnSecond,
      snapshot.runnerOnThird
    ),
    recommendation: rec.recommendation as ChallengeRecommendationResponseDto["recommendation"],
    minimumConfidenceThreshold: rec.minimumConfidenceRequired,
    expectedValue: rec.expectedValue,
    score: rec.score,
    displayMessage:
      RECOMMENDATION_DISPLAY_MESSAGES[rec.recommendation] ?? rec.recommendation,
    reasons: explanations,
    triggeredAt: rec.triggeredAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBaseState(
  first: boolean,
  second: boolean,
  third: boolean
): string {
  const occupied = [
    first && "1st",
    second && "2nd",
    third && "3rd",
  ].filter(Boolean) as string[];

  if (occupied.length === 0) return "Bases empty";
  if (occupied.length === 3) return "Bases loaded";

  const label = occupied.length === 1 ? "Runner on" : "Runners on";
  return `${label} ${occupied.join(" and ")}`;
}
