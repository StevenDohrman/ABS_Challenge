import { ChallengeDecisionInput } from "../domain/challengeDecision.types";
import { isBalls, isOuts, isStrikes } from "../domain/baseball.types";
import { computeChallengeOutcomeExpectancies } from "../data/runExpectancy";

/** Maximum allowed deviation between caller-supplied and computed current RE. */
export const RE_CONSISTENCY_TOLERANCE = 0.001;

export class ChallengeInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChallengeInputValidationError";
  }
}

function assertRateInRange(
  value: number | null,
  field: string,
  min = 0,
  max = 1
): void {
  if (value === null) return;
  if (value < min || value > max) {
    throw new ChallengeInputValidationError(
      `${field} must be between ${min} and ${max}, got ${value}`
    );
  }
}

/**
 * Validates baseball invariants and run-expectancy consistency before scoring.
 * Throws ChallengeInputValidationError on invalid caller input.
 */
export function validateChallengeDecisionInput(
  input: ChallengeDecisionInput
): void {
  const { gameState, playerContext } = input;

  if (!isBalls(gameState.balls)) {
    throw new ChallengeInputValidationError(
      `balls must be 0–3, got ${gameState.balls}`
    );
  }

  if (!isStrikes(gameState.strikes)) {
    throw new ChallengeInputValidationError(
      `strikes must be 0–2, got ${gameState.strikes}`
    );
  }

  if (!isOuts(gameState.outs)) {
    throw new ChallengeInputValidationError(
      `outs must be 0–2, got ${gameState.outs}`
    );
  }

  if (gameState.inning < 1) {
    throw new ChallengeInputValidationError(
      `inning must be >= 1, got ${gameState.inning}`
    );
  }

  if (gameState.challengesRemaining < 0) {
    throw new ChallengeInputValidationError(
      `challengesRemaining must be >= 0, got ${gameState.challengesRemaining}`
    );
  }

  assertRateInRange(playerContext.walkRate, "walkRate");
  assertRateInRange(playerContext.strikeoutRate, "strikeoutRate");
  assertRateInRange(playerContext.chasePercent, "chasePercent");
  assertRateInRange(playerContext.whiffPercent, "whiffPercent");
  assertRateInRange(
    playerContext.historicalChallengeSuccessRate,
    "historicalChallengeSuccessRate"
  );

  if (playerContext.historicalChallengeAttempts < 0) {
    throw new ChallengeInputValidationError(
      `historicalChallengeAttempts must be >= 0, got ${playerContext.historicalChallengeAttempts}`
    );
  }

  const runners = {
    first: gameState.runnerOnFirst,
    second: gameState.runnerOnSecond,
    third: gameState.runnerOnThird,
  };

  const expected = computeChallengeOutcomeExpectancies(
    gameState.outs,
    gameState.balls,
    gameState.strikes,
    runners
  );

  if (
    Math.abs(input.currentRunExpectancy - expected.current) >
    RE_CONSISTENCY_TOLERANCE
  ) {
    throw new ChallengeInputValidationError(
      `currentRunExpectancy (${input.currentRunExpectancy}) does not match ` +
        `computed value (${expected.current}) for the given game state`
    );
  }

  if (
    Math.abs(input.runExpectancyIfSuccessful - expected.ifSucceeds) >
    RE_CONSISTENCY_TOLERANCE
  ) {
    throw new ChallengeInputValidationError(
      `runExpectancyIfSuccessful (${input.runExpectancyIfSuccessful}) does not match ` +
        `computed value (${expected.ifSucceeds}) for the given game state`
    );
  }

  if (
    Math.abs(input.runExpectancyIfFailed - expected.ifFails) >
    RE_CONSISTENCY_TOLERANCE
  ) {
    throw new ChallengeInputValidationError(
      `runExpectancyIfFailed (${input.runExpectancyIfFailed}) does not match ` +
        `computed value (${expected.ifFails}) for the given game state`
    );
  }
}
