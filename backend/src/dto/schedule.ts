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
