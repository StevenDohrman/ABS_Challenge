export type GameAbstractState = "Preview" | "Live" | "Final";

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
