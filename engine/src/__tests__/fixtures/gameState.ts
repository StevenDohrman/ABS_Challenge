import { GameStateContext } from "../../domain/gameContext.types";

/** Default game state for tests — mid-game, neutral leverage, full challenge allotment. */
export function makeGameState(
  overrides: Partial<GameStateContext> = {}
): GameStateContext {
  return {
    gamePk: 1,
    inning: 5,
    halfInning: "top",
    balls: 1,
    strikes: 1,
    outs: 1,
    runnerOnFirst: false,
    runnerOnSecond: false,
    runnerOnThird: false,
    homeScore: 3,
    awayScore: 3,
    runDifferentialForBattingTeam: 0,
    battingTeamId: 1,
    fieldingTeamId: 2,
    batterId: 100,
    pitcherId: 200,
    challengesRemaining: 2,
    ...overrides,
  };
}
