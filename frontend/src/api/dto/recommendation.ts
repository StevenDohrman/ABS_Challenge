import type { PostgameAuditItem } from "./postgame";

export type RecommendationLabel = "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

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
