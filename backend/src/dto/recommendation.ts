import type {
  ChallengeRecommendation as DbRecommendation,
  LiveGameSnapshot,
  LivePitchEvent,
  PostgameChallengeAudit,
} from "@prisma/client";
import {
  buildDisplayMessage,
  formatBaseState,
  normalizeOutsAtAtBatStart,
} from "./utils";
import { toPostgameAuditItemDto, type PostgameAuditItemDto } from "./postgame";

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
   */
  minimumConfidenceThreshold: number;

  expectedValue: number;
  score: number;

  /**
   * Whether the batting team can physically challenge right now.
   */
  challengeAvailable: boolean;

  /** Primary display message derived from the recommendation label */
  displayMessage: string;
  /** Ordered explanation sentences from the engine */
  reasons: string[];

  /** ISO timestamp when this recommendation was triggered by a pitch event */
  triggeredAt: string;
}

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
    challengeAvailable: rec.challengeAvailable,
    displayMessage: buildDisplayMessage(rec.recommendation, rec.challengeAvailable),
    reasons: explanations,
    triggeredAt: rec.triggeredAt?.toISOString() ?? new Date().toISOString(),
  };
}

/** ABS challenge outcome for a single at-bat. Populated when a review occurred. */
export interface ChallengeOutcomeDto {
  wasChallenge: true;
  challengerName: string | null;
  /** "batter" when the batting team challenged a called strike; "fielding" when the fielding team challenged a ball. */
  challengerSide: "batter" | "fielding";
  /** True if the original call was reversed. Null when the review is still in progress. */
  isOverturned: boolean | null;
}

export interface AtBatHistoryItemDto {
  atBatIndex: number;
  inning: number;
  /** "Top" | "Bot" */
  halfInning: string;
  outs: number;
  baseState: string;
  batterId: number;
  pitcherId: number;

  /** The count that was actually triggered by a called strike, e.g. "1-2". Null if none triggered. */
  triggeredCount: string | null;
  /** The triggered recommendation label. Null if none triggered. */
  triggeredRecommendation: string | null;
  /** The triggered recommendation's expected value. Null if none triggered. */
  triggeredExpectedValue: number | null;

  /** Present when an ABS review (challenge) was recorded for any pitch in this at-bat. */
  challengeOutcome: ChallengeOutcomeDto | null;

  /** Postgame Savant audit for the triggered called-strike pitch, when available. */
  postgameAudit: PostgameAuditItemDto | null;

  /** All 12 pre-computed count state recommendations. */
  recommendations: CountStateRecommendationDto[];
}

export interface GameAtBatHistoryDto {
  gamePk: number;
  totalAtBats: number;
  atBats: AtBatHistoryItemDto[];
}

/**
 * One count-state cell in the pre-at-bat grid.
 */
export interface CountStateRecommendationDto {
  count: string;
  balls: number;
  strikes: number;
  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  minimumConfidenceThreshold: number;
  expectedValue: number;
  score: number;
  challengeAvailable: boolean;
  displayMessage: string;
}

/**
 * Pre-at-bat summary payload — one row per at-bat, consumed by the banner view.
 */
export interface AtBatRecommendationGridResponseDto {
  gamePk: number;
  atBatIndex: number;
  inning: number | null;
  halfInning: string | null;
  hasHighValueOpportunity: boolean;
  bestCount: string | null;
  bestRecommendation: string | null;
  bestExpectedValue: number | null;
  summaryMessage: string;
  recommendations: CountStateRecommendationDto[];
}

export function toGameAtBatHistoryDto(
  gamePk: number,
  snapshots: LiveGameSnapshot[],
  allRecs: DbRecommendation[],
  reviewPitchEvents: Pick<
    LivePitchEvent,
    "atBatIndex" | "isOverturned" | "challengerName" | "challengerTeamId"
  >[] = [],
  auditsByAtBat: Map<number, PostgameChallengeAudit> = new Map()
): GameAtBatHistoryDto {
  const recsByAtBat = new Map<number, DbRecommendation[]>();
  for (const r of allRecs) {
    const arr = recsByAtBat.get(r.atBatIndex) ?? [];
    arr.push(r);
    recsByAtBat.set(r.atBatIndex, arr);
  }

  const reviewByAtBat = new Map<
    number,
    Pick<
      LivePitchEvent,
      "atBatIndex" | "isOverturned" | "challengerName" | "challengerTeamId"
    >
  >();
  for (const pe of reviewPitchEvents) {
    if (!reviewByAtBat.has(pe.atBatIndex)) reviewByAtBat.set(pe.atBatIndex, pe);
  }

  const atBats: AtBatHistoryItemDto[] = snapshots.map((snap) => {
    const recs = recsByAtBat.get(snap.atBatIndex) ?? [];
    const triggered = recs.find((r) => r.triggeredAt !== null) ?? null;

    const recommendations: CountStateRecommendationDto[] = recs
      .sort((a, b) => a.balls - b.balls || a.strikes - b.strikes)
      .map((r) => ({
        count: `${r.balls}-${r.strikes}`,
        balls: r.balls,
        strikes: r.strikes,
        recommendation: r.recommendation as CountStateRecommendationDto["recommendation"],
        minimumConfidenceThreshold: r.minimumConfidenceRequired,
        expectedValue: r.expectedValue,
        score: r.score,
        challengeAvailable: r.challengeAvailable,
        displayMessage: buildDisplayMessage(r.recommendation, r.challengeAvailable),
      }));

    const reviewEvent = reviewByAtBat.get(snap.atBatIndex) ?? null;
    const challengeOutcome: ChallengeOutcomeDto | null = reviewEvent
      ? {
          wasChallenge: true,
          challengerName: reviewEvent.challengerName,
          challengerSide:
            reviewEvent.challengerTeamId === snap.battingTeamId ? "batter" : "fielding",
          isOverturned: reviewEvent.isOverturned,
        }
      : null;

    return {
      atBatIndex: snap.atBatIndex,
      inning: snap.inning,
      halfInning: snap.halfInning === "top" ? "Top" : "Bot",
      outs: normalizeOutsAtAtBatStart(snap.outs),
      baseState: formatBaseState(
        snap.runnerOnFirst,
        snap.runnerOnSecond,
        snap.runnerOnThird
      ),
      batterId: snap.batterId,
      pitcherId: snap.pitcherId,
      triggeredCount: triggered ? `${triggered.balls}-${triggered.strikes}` : null,
      triggeredRecommendation: triggered?.recommendation ?? null,
      triggeredExpectedValue: triggered?.expectedValue ?? null,
      challengeOutcome,
      postgameAudit: auditsByAtBat.has(snap.atBatIndex)
        ? toPostgameAuditItemDto(auditsByAtBat.get(snap.atBatIndex)!)
        : null,
      recommendations,
    };
  });

  return { gamePk, totalAtBats: atBats.length, atBats };
}

export function toAtBatGridDto(
  gamePk: number,
  atBatIndex: number,
  rows: DbRecommendation[],
  inning?: number,
  halfInning?: string
): AtBatRecommendationGridResponseDto {
  const sorted = [...rows].sort(
    (a, b) => a.balls - b.balls || a.strikes - b.strikes
  );

  const recommendations: CountStateRecommendationDto[] = sorted.map((r) => ({
    count: `${r.balls}-${r.strikes}`,
    balls: r.balls,
    strikes: r.strikes,
    recommendation: r.recommendation as CountStateRecommendationDto["recommendation"],
    minimumConfidenceThreshold: r.minimumConfidenceRequired,
    expectedValue: r.expectedValue,
    score: r.score,
    challengeAvailable: r.challengeAvailable,
    displayMessage: buildDisplayMessage(r.recommendation, r.challengeAvailable),
  }));

  const best =
    sorted.length > 0
      ? sorted.reduce((prev, cur) => (cur.score > prev.score ? cur : prev))
      : null;

  const hasHighValueOpportunity =
    best !== null && (best.recommendation === "AUTO_ALLOW" || best.recommendation === "ALLOW");

  let summaryMessage: string;
  if (!best) {
    summaryMessage = "No pre-computed recommendations available for this at-bat.";
  } else if (hasHighValueOpportunity) {
    const sign = best.expectedValue >= 0 ? "+" : "";
    const detail = `${best.recommendation}, ${sign}${best.expectedValue.toFixed(2)} RE`;
    summaryMessage = best.challengeAvailable
      ? `Best opportunity at ${best.balls}-${best.strikes} (${detail})`
      : `Missed opportunity at ${best.balls}-${best.strikes} — out of challenges (${detail})`;
  } else {
    summaryMessage = "Low challenge value this at-bat — save your challenges.";
  }

  return {
    gamePk,
    atBatIndex,
    inning: inning ?? null,
    halfInning: halfInning ?? null,
    hasHighValueOpportunity,
    bestCount: best ? `${best.balls}-${best.strikes}` : null,
    bestRecommendation: best ? best.recommendation : null,
    bestExpectedValue: best ? best.expectedValue : null,
    summaryMessage,
    recommendations,
  };
}

/** Build grid DTO from in-memory engine decisions (branch preview — no DB). */
export function toAtBatGridFromDecisions(
  gamePk: number,
  atBatIndex: number,
  rows: Array<{
    balls: number;
    strikes: number;
    recommendation: string;
    minimumConfidenceRequired: number;
    expectedValue: number;
    score: number;
    challengeAvailable: boolean;
  }>,
  inning?: number,
  halfInning?: string
): AtBatRecommendationGridResponseDto {
  const recommendations: CountStateRecommendationDto[] = rows.map((r) => ({
    count: `${r.balls}-${r.strikes}`,
    balls: r.balls,
    strikes: r.strikes,
    recommendation: r.recommendation as CountStateRecommendationDto["recommendation"],
    minimumConfidenceThreshold: r.minimumConfidenceRequired,
    expectedValue: r.expectedValue,
    score: r.score,
    challengeAvailable: r.challengeAvailable,
    displayMessage: buildDisplayMessage(r.recommendation, r.challengeAvailable),
  }));

  const best =
    rows.length > 0
      ? rows.reduce((prev, cur) => (cur.score > prev.score ? cur : prev))
      : null;

  const hasHighValueOpportunity =
    best !== null &&
    (best.recommendation === "AUTO_ALLOW" || best.recommendation === "ALLOW");

  let summaryMessage: string;
  if (!best) {
    summaryMessage = "No recommendations computed for this situation.";
  } else if (hasHighValueOpportunity) {
    const sign = best.expectedValue >= 0 ? "+" : "";
    const detail = `${best.recommendation}, ${sign}${best.expectedValue.toFixed(2)} RE`;
    summaryMessage = best.challengeAvailable
      ? `Best opportunity at ${best.balls}-${best.strikes} (${detail})`
      : `Missed opportunity at ${best.balls}-${best.strikes} — out of challenges (${detail})`;
  } else {
    summaryMessage = "Low challenge value this situation — save your challenges.";
  }

  return {
    gamePk,
    atBatIndex,
    inning: inning ?? null,
    halfInning: halfInning ?? null,
    hasHighValueOpportunity,
    bestCount: best ? `${best.balls}-${best.strikes}` : null,
    bestRecommendation: best ? best.recommendation : null,
    bestExpectedValue: best ? best.expectedValue : null,
    summaryMessage,
    recommendations,
  };
}
