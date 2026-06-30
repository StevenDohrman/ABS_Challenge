/**
 * Frontend API types — mirrors backend/src/challenge.dto.ts by convention.
 */

export type RecommendationLabel = "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
export type GameAbstractState = "Preview" | "Live" | "Final";

// ─────────────────────────────────────────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleGame {
  gamePk: number;
  officialDate: string;
  scheduledStartTime: string;
  abstractState: GameAbstractState;
  detailedState: string;

  homeTeamId: number;
  homeTeamName: string;
  homeTeamAbbrev: string;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamAbbrev: string;

  homeScore: number | null;
  awayScore: number | null;

  currentInning: number | null;
  currentInningHalf: string | null;
  balls: number | null;
  strikes: number | null;
  outs: number | null;

  isTracked: boolean;
  hasTriggeredRecommendation: boolean;

  /** Challenges remaining for the home team (null when not tracked). */
  homeChallengesRemaining: number | null;
  /** Challenges remaining for the away team (null when not tracked). */
  awayChallengesRemaining: number | null;
}

export interface ScheduleResponse {
  date: string;
  games: ScheduleGame[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Live pitch recommendation
// ─────────────────────────────────────────────────────────────────────────────

export interface ChallengeRecommendationResponse {
  gamePk: number;
  count: string;
  inning: number;
  halfInning: string;
  outs: number;
  baseState: string;

  recommendation: RecommendationLabel;
  minimumConfidenceThreshold: number;
  expectedValue: number;
  score: number;

  /** False when the team is out of challenges — a positive call is a missed opportunity. */
  challengeAvailable: boolean;

  displayMessage: string;
  reasons: string[];
  triggeredAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-at-bat grid
// ─────────────────────────────────────────────────────────────────────────────

export interface CountStateRecommendation {
  count: string;
  balls: number;
  strikes: number;
  recommendation: RecommendationLabel;
  minimumConfidenceThreshold: number;
  expectedValue: number;
  score: number;
  /** False when the team is out of challenges — a positive call is a missed opportunity. */
  challengeAvailable: boolean;
  displayMessage: string;
}

export interface AtBatRecommendationGridResponse {
  gamePk: number;
  atBatIndex: number;
  inning: number | null;
  halfInning: string | null;
  hasHighValueOpportunity: boolean;
  bestCount: string | null;
  bestRecommendation: string | null;
  bestExpectedValue: number | null;
  summaryMessage: string;
  recommendations: CountStateRecommendation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Game at-bat history
// ─────────────────────────────────────────────────────────────────────────────

export interface ChallengeOutcome {
  wasChallenge: true;
  challengerName: string | null;
  challengerSide: "batter" | "fielding";
  isOverturned: boolean | null;
}

export interface AtBatHistoryItem {
  atBatIndex: number;
  inning: number;
  halfInning: string;
  outs: number;
  baseState: string;
  batterId: number;
  pitcherId: number;

  triggeredCount: string | null;
  triggeredRecommendation: string | null;
  triggeredExpectedValue: number | null;

  challengeOutcome: ChallengeOutcome | null;

  postgameAudit: PostgameAuditItem | null;

  recommendations: CountStateRecommendation[];
}

export interface GameAtBatHistoryResponse {
  gamePk: number;
  totalAtBats: number;
  atBats: AtBatHistoryItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgame audit
// ─────────────────────────────────────────────────────────────────────────────

export type PostgameAuditStatus = "pending" | "ready" | "unavailable";

export interface PostgameAuditItem {
  atBatIndex: number;
  pitchNumber: number;
  inning: number;
  halfInning: string;
  battingSide: PostgameBattingSide;
  count: string;
  batterId: number;
  pitcherId: number;

  liveRecommendation: RecommendationLabel;
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

export type PostgameBattingSide = "home" | "away";

export interface PostgameAuditTeamSummary {
  teamId: number;
  side: PostgameBattingSide;
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  topMissed: PostgameAuditItem[];
}

export interface PostgameAuditSummary {
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  shouldHaveChallengedCount: number;
  topMissed: PostgameAuditItem[];
  byTeam: {
    away: PostgameAuditTeamSummary;
    home: PostgameAuditTeamSummary;
  };
}

export interface PostgameAuditResponse {
  gamePk: number;
  status: PostgameAuditStatus;
  enrichedAt: string | null;
  pollEarliestAt: string | null;
  summary: PostgameAuditSummary;
  missedChallenges: PostgameAuditItem[];
  allAudits: PostgameAuditItem[];
}
