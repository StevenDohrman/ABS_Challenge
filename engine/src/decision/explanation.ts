/**
 * Explanation Builder
 *
 * Generates the ordered list of human-readable sentences that explain why
 * the engine produced a given recommendation.
 *
 * The explanation is intentionally brief (3–6 sentences) and prioritized:
 *   1. Primary recommendation summary
 *   2. Run expectancy impact (quantified)
 *   3. Player credibility signal (if notable)
 *   4. Game situation comment (if notable)
 *   5. Scarcity warning (if applicable)
 *   6. Confidence threshold sentence (always)
 *
 * Each sentence is standalone and can be displayed as a bullet point.
 */

import { ChallengeDecision, ChallengeRecommendation } from "../domain/challengeDecision.types";
import { PlayerCredibilityResult } from "../features/playerCredibility";
import { SituationWeightResult } from "../features/situationWeight";
import { ChallengeScarcityResult } from "../features/challengeScarcity";
import { ThresholdResult } from "./thresholds";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface ExplanationInput {
  recommendation: ChallengeRecommendation;
  score: number;
  reDelta: number;
  adjustedEV: number;
  credibility: PlayerCredibilityResult;
  situation: SituationWeightResult;
  scarcity: ChallengeScarcityResult;
  thresholdResult: ThresholdResult;

  balls: number;
  strikes: number;
  inning: number;
  halfInning: "top" | "bottom";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function buildExplanation(input: ExplanationInput): string[] {
  // The explanation describes the value of the call only. Whether the team can
  // actually challenge (it may be out of challenges) is an availability concern
  // surfaced separately by the backend/DTO layer, so it is intentionally not
  // mentioned here.
  const sentences: string[] = [];

  sentences.push(buildPrimaryStatement(input));
  sentences.push(buildRunExpectancySentence(input));

  const credibilitySentence = buildCredibilitySentence(input.credibility);
  if (credibilitySentence) sentences.push(credibilitySentence);

  const situationSentence = buildSituationSentence(input.situation, input.inning, input.halfInning);
  if (situationSentence) sentences.push(situationSentence);

  const scarcitySentence = buildScarcitySentence(input.scarcity);
  if (scarcitySentence) sentences.push(scarcitySentence);

  sentences.push(buildConfidenceSentence(input));

  return sentences;
}

// ---------------------------------------------------------------------------
// Sentence builders
// ---------------------------------------------------------------------------

function buildPrimaryStatement(input: ExplanationInput): string {
  const count = `${input.balls}-${input.strikes}`;

  switch (input.recommendation) {
    case "AUTO_ALLOW":
      return `Strong case for a challenge: the ${count} count creates a high-value opportunity with solid expected return.`;
    case "ALLOW":
      return `Challenging is worth considering on this ${count} count call if the player feels confident.`;
    case "WARN":
      return `Caution on this ${count} count call — the expected value does not strongly justify using a challenge.`;
    case "DENY":
      return `Do not challenge this ${count} count call — the expected value is insufficient to justify the cost.`;
  }
}

function buildRunExpectancySentence(input: ExplanationInput): string {
  const delta = Math.abs(input.reDelta).toFixed(2);
  const pct = Math.round(input.credibility.pCallWasWrong * 100);

  if (input.reDelta >= 0.10) {
    return `A successful challenge would shift run expectancy by +${delta} runs; at an estimated ${pct}% chance the call was wrong, this is worth pursuing.`;
  }

  if (input.reDelta >= 0.01) {
    return `The run expectancy swing from a successful challenge is modest (+${delta} runs), and at ${pct}% estimated call accuracy, the edge is thin.`;
  }

  return `The run expectancy difference between success and failure is minimal (${delta} runs), making this call difficult to justify challenging.`;
}

function buildCredibilitySentence(
  credibility: PlayerCredibilityResult
): string | null {
  const { baselineDisciplineScore, historicalBlendWeight } = credibility.components;

  if (historicalBlendWeight >= 0.5) {
    const pct = Math.round(credibility.pCallWasWrong * 100);
    return `This batter has a strong challenge history, which raised their credibility estimate to ${pct}%.`;
  }

  if (baselineDisciplineScore > 0.05) {
    return `This batter's low chase rate and high walk rate suggest reliable zone recognition — credibility is above average.`;
  }

  if (baselineDisciplineScore < -0.05) {
    return `This batter's elevated chase rate reduces confidence in their ability to identify borderline pitches accurately.`;
  }

  return null; // Neutral discipline — not worth mentioning
}

function buildSituationSentence(
  situation: SituationWeightResult,
  inning: number,
  halfInning: "top" | "bottom"
): string | null {
  const { isLateAndClose, isBlowout, isExtraInnings, inningLeverage, runDiffLeverage } = situation.components;

  if (isExtraInnings) {
    return `Extra innings — every run and every challenge is at maximum value.`;
  }

  if (isLateAndClose) {
    const half = halfInning === "bottom" ? "bottom" : "top";
    return `${half.charAt(0).toUpperCase() + half.slice(1)} of the ${ordinal(inning)} in a tight game — situation leverage is high.`;
  }

  if (isBlowout) {
    return `The large run differential significantly reduces the leverage of any single challenge.`;
  }

  if (inningLeverage < 0.75 && runDiffLeverage < 0.80) {
    return `Early innings with a comfortable run gap — challenge value is below average for this situation.`;
  }

  return null; // Unremarkable situation — no sentence needed
}

function buildScarcitySentence(scarcity: ChallengeScarcityResult): string | null {
  switch (scarcity.scarcityLevel) {
    case "scarce":
      return `Only 1 challenge remaining — thresholds have been raised significantly; save it for a clear opportunity.`;
    case "moderate":
      return `2 challenges remaining — a slight premium has been applied to the recommendation threshold.`;
    case "plenty":
      return null;
    case "none":
      // Out of challenges adds no scarcity penalty (the recommendation reflects
      // the call's raw value); availability is surfaced by the backend/DTO layer.
      return null;
  }
}

function buildConfidenceSentence(input: ExplanationInput): string {
  const minConf = input.thresholdResult.minimumPlayerConfidenceRequired;

  if (input.recommendation === "AUTO_ALLOW") {
    return `Recommend challenging regardless of player confidence given the strength of this situation.`;
  }

  if (input.recommendation === "DENY") {
    return `No level of player confidence justifies using a challenge here.`;
  }

  return `Challenge if the player expresses at least ${minConf}% confidence the call was wrong.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const suffix = ["th", "st", "nd", "rd"];
  const value = n % 100;
  return n + (suffix[(value - 20) % 10] ?? suffix[value] ?? suffix[0]);
}

// Satisfy the import — ChallengeDecision is used as the return context type
// in decideChallenge.ts so we export a helper type alias here for clarity.
export type { ChallengeDecision };
