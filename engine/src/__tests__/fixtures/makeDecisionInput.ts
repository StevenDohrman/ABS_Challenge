import { ChallengeDecisionInput } from "../../domain/challengeDecision.types";
import { GameStateContext } from "../../domain/gameContext.types";
import { PlayerChallengeContext } from "../../domain/playerContext.types";
import { PitchCallContext } from "../../domain/pitchContext.types";
import { computeChallengeOutcomeExpectancies } from "../../data/runExpectancy";
import { averagePlayer } from "./players";

export const calledStrike: PitchCallContext = {
  callType: "called_strike",
  pitcherHandedness: "R",
};

export function makeDecisionInput(
  gameState: GameStateContext,
  player: PlayerChallengeContext = averagePlayer,
  pitch: PitchCallContext = calledStrike
): ChallengeDecisionInput {
  const runners = {
    first: gameState.runnerOnFirst,
    second: gameState.runnerOnSecond,
    third: gameState.runnerOnThird,
  };

  const { current, ifSucceeds, ifFails } = computeChallengeOutcomeExpectancies(
    gameState.outs,
    gameState.balls,
    gameState.strikes,
    runners
  );

  return {
    gameState,
    playerContext: player,
    pitchContext: pitch,
    currentRunExpectancy: current,
    runExpectancyIfSuccessful: ifSucceeds,
    runExpectancyIfFailed: ifFails,
  };
}
