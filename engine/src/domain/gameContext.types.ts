export interface GameStateContext {
  gamePk: number;

  inning: number;
  halfInning: "top" | "bottom";
  outs: number;

  balls: number;
  strikes: number;

  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;

  homeScore: number;
  awayScore: number;
  runDifferentialForBattingTeam: number;

  battingTeamId: number;
  fieldingTeamId: number;

  batterId: number;
  pitcherId: number;

  challengesRemaining: number;
}