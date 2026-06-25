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

  recommendations: CountStateRecommendation[];
}

export interface GameAtBatHistoryResponse {
  gamePk: number;
  totalAtBats: number;
  atBats: AtBatHistoryItem[];
}
