export type ChallengeRecommendation = "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

export interface ChallengeDecisionInput {
  gameState: GameStateContext;
  playerContext: PlayerChallengeContext;
  pitchConfidence: PitchConfidenceContext;

  currentRunExpectancy: number;
  runExpectancyIfSuccessful: number;
  runExpectancyIfFailed: number;
}

export interface ChallengeDecision {
  recommendation: ChallengeRecommendation;
  score: number;
  expectedValueOfChallenge: number;
  minimumPlayerConfidenceRequired: number;
  explanation: string[];
}