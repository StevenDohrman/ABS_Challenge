export interface ChallengeCardViewModel {
  title: string;
  recommendationLabel: string;
  recommendationTone: "green" | "yellow" | "red";
  confidenceText: string;
  reasons: string[];
  gameSituationText: string;
}