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

function assertFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new ChallengeInputValidationError(
      `${field} must be a finite number, got ${value}`
    );
  }
}

function assertPositiveInteger(value: number, field: string): void {
  assertFiniteNumber(value, field);
  if (!Number.isInteger(value) || value < 1) {
    throw new ChallengeInputValidationError(
      `${field} must be a positive integer, got ${value}`
    );
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  assertFiniteNumber(value, field);
  if (!Number.isInteger(value) || value < 0) {
    throw new ChallengeInputValidationError(
      `${field} must be a non-negative integer, got ${value}`
    );
  }
}

function assertRateInRange(
  value: number | null,
  field: string,
  min = 0,
  max = 1
): void {
  if (value === null) return;

  assertFiniteNumber(value, field);

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

  if (!Number.isFinite(gameState.balls) || !isBalls(gameState.balls)) {
    throw new ChallengeInputValidationError(
      `balls must be 0–3, got ${gameState.balls}`
    );
  }

  if (!Number.isFinite(gameState.strikes) || !isStrikes(gameState.strikes)) {
    throw new ChallengeInputValidationError(
      `strikes must be 0–2, got ${gameState.strikes}`
    );
  }

  if (!Number.isFinite(gameState.outs) || !isOuts(gameState.outs)) {
    throw new ChallengeInputValidationError(
      `outs must be 0–2, got ${gameState.outs}`
    );
  }

  assertPositiveInteger(gameState.inning, "inning");
  assertNonNegativeInteger(
    gameState.challengesRemaining,
    "challengesRemaining"
  );

  assertRateInRange(playerContext.walkRate, "walkRate");
  assertRateInRange(playerContext.strikeoutRate, "strikeoutRate");
  assertRateInRange(playerContext.chasePercent, "chasePercent");
  assertRateInRange(playerContext.whiffPercent, "whiffPercent");
  assertRateInRange(
    playerContext.historicalChallengeSuccessRate,
    "historicalChallengeSuccessRate"
  );

  assertNonNegativeInteger(
    playerContext.historicalChallengeAttempts,
    "historicalChallengeAttempts"
  );

  const runners = {
    first: gameState.runnerOnFirst,
    second: gameState.runnerOnSecond,
    third: gameState.runnerOnThird,
  };

  const expected = computeChallengeOutcomeExpectancies(
    gameState.outs,
    gameState.balls,
    gameState.strikes,
    runners,
    input.countDeltaContext
  );

  for (const [field, value] of [
    ["currentRunExpectancy", input.currentRunExpectancy],
    ["runExpectancyIfSuccessful", input.runExpectancyIfSuccessful],
    ["runExpectancyIfFailed", input.runExpectancyIfFailed],
  ] as const) {
    assertFiniteNumber(value, field);
  }

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
