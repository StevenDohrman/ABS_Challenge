/**
 * Backend DTOs — the shapes the API returns to the frontend.
 *
 * These are deliberately separate from the engine's domain types so the
 * frontend never has to know about MLB API field names or engine internals.
 *
 * All data in these DTOs originates from MLB Live API or Baseball Savant.
 * No user input enters the recommendation system.
 */

import type { ChallengeRecommendation as DbRecommendation, LiveGameSnapshot, LivePitchEvent, PostgameChallengeAudit } from "@prisma/client";
import { savantPollEarliestAt } from "./db/constants";

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

  /**
   * Whether the batting team can physically challenge right now (had at least
   * one challenge available for this at-bat). The recommendation/expectedValue
   * above are value-based regardless; when this is false a positive
   * recommendation represents a missed opportunity rather than an action to take.
   */
  challengeAvailable: boolean;

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
 * Build the display message, accounting for challenge availability.
 *
 * When the team is out of challenges, a positive recommendation is reframed as a
 * missed opportunity (the value-based call is still shown, but it cannot be acted
 * on). A negative recommendation simply notes there is nothing to spend.
 */
function buildDisplayMessage(
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
    challengeAvailable: rec.challengeAvailable,
    displayMessage: buildDisplayMessage(rec.recommendation, rec.challengeAvailable),
    reasons: explanations,
    triggeredAt: rec.triggeredAt?.toISOString() ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Today's schedule
// ─────────────────────────────────────────────────────────────────────────────

export type GameAbstractState = "Preview" | "Live" | "Final";

/** One game card shown on the dashboard. */
export interface ScheduleGameDto {
  gamePk: number;
  officialDate: string;
  /** ISO 8601 scheduled start time (UTC). */
  scheduledStartTime: string;

  /** MLB abstract state: Preview | Live | Final */
  abstractState: GameAbstractState;
  /** More granular status: "Scheduled" | "Pre-Game" | "Warmup" | "In Progress" | "Final" | "Postponed" | etc. */
  detailedState: string;

  homeTeamId: number;
  homeTeamName: string;
  homeTeamAbbrev: string;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamAbbrev: string;

  /** Null before the game starts. */
  homeScore: number | null;
  awayScore: number | null;

  /** Current inning number (null when not Live). */
  currentInning: number | null;
  /** "Top" | "Bot" (null when not Live). */
  currentInningHalf: string | null;
  /** Live count state (null when not Live). */
  balls: number | null;
  strikes: number | null;
  outs: number | null;

  /** True if this game's data is in our DB (pipeline has tracked it). */
  isTracked: boolean;
  /** True if at least one recommendation has been triggered for this game. */
  hasTriggeredRecommendation: boolean;

  /** Challenges remaining for the home team (null when game is not tracked). */
  homeChallengesRemaining: number | null;
  /** Challenges remaining for the away team (null when game is not tracked). */
  awayChallengesRemaining: number | null;
}

export interface ScheduleResponseDto {
  date: string;
  games: ScheduleGameDto[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Game at-bat history (post-game / in-game audit)
// ─────────────────────────────────────────────────────────────────────────────

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
 * Build the game at-bat history DTO from DB rows.
 *
 * @param reviewPitchEvents Pitch events with hasReview=true for this game.
 *   Used to populate challengeOutcome on each at-bat row.
 */
export function toGameAtBatHistoryDto(
  gamePk: number,
  snapshots: LiveGameSnapshot[],
  allRecs: DbRecommendation[],
  reviewPitchEvents: Pick<LivePitchEvent, "atBatIndex" | "isOverturned" | "challengerName" | "challengerTeamId">[] = [],
  auditsByAtBat: Map<number, PostgameChallengeAudit> = new Map()
): GameAtBatHistoryDto {
  const recsByAtBat = new Map<number, DbRecommendation[]>();
  for (const r of allRecs) {
    const arr = recsByAtBat.get(r.atBatIndex) ?? [];
    arr.push(r);
    recsByAtBat.set(r.atBatIndex, arr);
  }

  // Index review events by atBatIndex for O(1) lookup.
  const reviewByAtBat = new Map<
    number,
    Pick<LivePitchEvent, "atBatIndex" | "isOverturned" | "challengerName" | "challengerTeamId">
  >();
  for (const pe of reviewPitchEvents) {
    // Keep only the first review per at-bat (multiple reviews are extremely rare).
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
      baseState: formatBaseState(snap.runnerOnFirst, snap.runnerOnSecond, snap.runnerOnThird),
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

// ─────────────────────────────────────────────────────────────────────────────
// At-bat recommendation grid response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One count-state cell in the pre-at-bat grid (no snapshot context needed —
 * the count itself encodes the game situation for display).
 */
export interface CountStateRecommendationDto {
  count: string;   // "0-0" … "3-2"
  balls: number;
  strikes: number;
  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  minimumConfidenceThreshold: number;
  expectedValue: number;
  score: number;
  /**
   * Whether the batting team could physically challenge this at-bat. False marks
   * a missed opportunity: the value-based recommendation stands, but the team had
   * no challenge to spend.
   */
  challengeAvailable: boolean;
  displayMessage: string;
}

/**
 * Pre-at-bat summary payload — one row per at-bat, consumed by the banner view.
 */
export interface AtBatRecommendationGridResponseDto {
  gamePk: number;
  atBatIndex: number;
  /** Inning number for this at-bat (from the DB snapshot). */
  inning: number | null;
  /** "Top" or "Bot" for the half-inning. */
  halfInning: string | null;
  /** True when at least one count state has an AUTO_ALLOW or ALLOW recommendation. */
  hasHighValueOpportunity: boolean;
  /** Count string for the highest-scoring recommendation, e.g. "3-2". Null when grid is empty. */
  bestCount: string | null;
  /** Recommendation label for the best count. Null when grid is empty. */
  bestRecommendation: string | null;
  /** Expected value for the best count. Null when grid is empty. */
  bestExpectedValue: number | null;
  /**
   * Short human-readable summary sentence.
   * E.g. "Best opportunity at full count (AUTO_ALLOW, +0.14 RE)" or
   * "Low challenge value this at-bat — save challenges."
   */
  summaryMessage: string;
  /** All 12 count states, ordered 0-0 → 3-2. */
  recommendations: CountStateRecommendationDto[];
}

/**
 * Build the at-bat recommendation grid DTO from DB rows.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Outs at the start of an at-bat are always 0, 1, or 2 (never 3). */
function normalizeOutsAtAtBatStart(outs: number): number {
  return Math.min(Math.max(0, outs), 2);
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Postgame challenge audit
// ─────────────────────────────────────────────────────────────────────────────

export type PostgameAuditStatus = "pending" | "ready" | "unavailable";

export type PostgameBattingSide = "home" | "away";

export interface PostgameAuditItemDto {
  atBatIndex: number;
  pitchNumber: number;
  inning: number;
  halfInning: string;
  /** Team at bat for this pitch (Top → away, Bot → home). */
  battingSide: PostgameBattingSide;
  count: string;
  batterId: number;
  pitcherId: number;

  liveRecommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  expectedValue: number;
  challengeAvailable: boolean;

  originalCall: "ball" | "strike" | "unknown";
  savantZoneResult: "ball" | "strike" | "unknown";
  plateX: number | null;
  plateZ: number | null;

  callWasProbablyWrong: boolean;
  shouldHaveChallenged: boolean;
  missedChallenge: boolean;
  badChallengeAllowed: boolean;

  notes: string[];
}

export interface PostgameAuditTeamSummaryDto {
  teamId: number;
  side: PostgameBattingSide;
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  topMissed: PostgameAuditItemDto[];
}

export interface PostgameAuditSummaryDto {
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  shouldHaveChallengedCount: number;
  topMissed: PostgameAuditItemDto[];
  byTeam: {
    away: PostgameAuditTeamSummaryDto;
    home: PostgameAuditTeamSummaryDto;
  };
}

export interface PostgameAuditResponseDto {
  gamePk: number;
  status: PostgameAuditStatus;
  enrichedAt: string | null;
  /** ISO timestamp when Savant polling becomes eligible (Final + 14h). Null when unknown. */
  pollEarliestAt: string | null;
  summary: PostgameAuditSummaryDto;
  missedChallenges: PostgameAuditItemDto[];
  allAudits: PostgameAuditItemDto[];
}

export function battingSideFromHalfInning(halfInning: string): PostgameBattingSide {
  return halfInning.toLowerCase() === "top" ? "away" : "home";
}

export function toPostgameAuditItemDto(
  audit: PostgameChallengeAudit
): PostgameAuditItemDto {
  const notes = Array.isArray(audit.notesJson)
    ? (audit.notesJson as string[])
    : [];

  return {
    atBatIndex: audit.atBatIndex,
    pitchNumber: audit.pitchNumber,
    inning: audit.inning,
    halfInning: audit.halfInning === "top" ? "Top" : "Bot",
    battingSide: battingSideFromHalfInning(audit.halfInning),
    count: `${audit.balls}-${audit.strikes}`,
    batterId: audit.batterId,
    pitcherId: audit.pitcherId,
    liveRecommendation: audit.liveRecommendation as PostgameAuditItemDto["liveRecommendation"],
    expectedValue: audit.runExpectancySwing,
    challengeAvailable: audit.challengeAvailable,
    originalCall: audit.originalCall as PostgameAuditItemDto["originalCall"],
    savantZoneResult: audit.savantZoneResult as PostgameAuditItemDto["savantZoneResult"],
    plateX: audit.plateX,
    plateZ: audit.plateZ,
    callWasProbablyWrong: audit.callWasProbablyWrong,
    shouldHaveChallenged: audit.shouldHaveChallenged,
    missedChallenge: audit.missedChallenge,
    badChallengeAllowed: audit.badChallengeAllowed,
    notes,
  };
}

function buildTeamSummary(
  side: PostgameBattingSide,
  teamId: number,
  missedChallenges: PostgameAuditItemDto[],
  allAudits: PostgameAuditItemDto[]
): PostgameAuditTeamSummaryDto {
  const teamMissed = missedChallenges.filter((a) => a.battingSide === side);
  return {
    teamId,
    side,
    totalMissedValue: teamMissed.reduce((sum, a) => sum + a.expectedValue, 0),
    missedChallengeCount: teamMissed.length,
    badChallengeCount: allAudits.filter(
      (a) => a.badChallengeAllowed && a.battingSide === side
    ).length,
    topMissed: teamMissed.slice(0, 3),
  };
}

export function toPostgameAuditResponseDto(
  gamePk: number,
  status: PostgameAuditStatus,
  enrichedAt: Date | null,
  audits: PostgameChallengeAudit[],
  finalizedAt: Date | null = null,
  teamIds?: { homeTeamId: number; awayTeamId: number }
): PostgameAuditResponseDto {
  const allAudits = audits.map(toPostgameAuditItemDto);
  const missedChallenges = allAudits
    .filter((a) => a.missedChallenge)
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const totalMissedValue = missedChallenges.reduce(
    (sum, a) => sum + a.expectedValue,
    0
  );

  const homeTeamId = teamIds?.homeTeamId ?? 0;
  const awayTeamId = teamIds?.awayTeamId ?? 0;

  return {
    gamePk,
    status,
    enrichedAt: enrichedAt?.toISOString() ?? null,
    pollEarliestAt: finalizedAt ? savantPollEarliestAt(finalizedAt).toISOString() : null,
    summary: {
      totalMissedValue,
      missedChallengeCount: missedChallenges.length,
      badChallengeCount: allAudits.filter((a) => a.badChallengeAllowed).length,
      shouldHaveChallengedCount: allAudits.filter((a) => a.shouldHaveChallenged).length,
      topMissed: missedChallenges.slice(0, 3),
      byTeam: {
        away: buildTeamSummary("away", awayTeamId, missedChallenges, allAudits),
        home: buildTeamSummary("home", homeTeamId, missedChallenges, allAudits),
      },
    },
    missedChallenges,
    allAudits,
  };
}
