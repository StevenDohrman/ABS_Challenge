export interface ChallengeRecommendationResponseDto {
  gamePk: number;
  pitchId: string;

  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

  minimumConfidenceRequired: number;
  expectedValue: number;

  displayMessage: string;
  reasons: string[];

  inning: number;
  count: string;
  outs: number;
  baseState: string;
}