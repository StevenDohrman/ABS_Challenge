import {
  validateChallengeDecisionInput,
  ChallengeInputValidationError,
} from "../validation/validateInput";
import { makeGameState } from "./fixtures/gameState";
import { makeDecisionInput } from "./fixtures/makeDecisionInput";
import { aggressivePlayer } from "./fixtures/players";

describe("validateChallengeDecisionInput", () => {
  test("accepts valid input from makeDecisionInput", () => {
    expect(() =>
      validateChallengeDecisionInput(makeDecisionInput(makeGameState()))
    ).not.toThrow();
  });

  test("rejects invalid balls count", () => {
    const input = makeDecisionInput(makeGameState({ balls: 4 as 0 }));
    expect(() => validateChallengeDecisionInput(input)).toThrow(
      ChallengeInputValidationError
    );
  });

  test("rejects invalid strikes count", () => {
    const input = makeDecisionInput(makeGameState({ strikes: 3 as 0 }));
    expect(() => validateChallengeDecisionInput(input)).toThrow(
      ChallengeInputValidationError
    );
  });

  test("rejects mismatched currentRunExpectancy", () => {
    const input = makeDecisionInput(makeGameState());
    input.currentRunExpectancy = 999;
    expect(() => validateChallengeDecisionInput(input)).toThrow(
      /currentRunExpectancy/
    );
  });

  test("rejects out-of-range chase rate", () => {
    const input = makeDecisionInput(
      makeGameState(),
      { ...aggressivePlayer, chasePercent: 1.5 }
    );
    expect(() => validateChallengeDecisionInput(input)).toThrow(/chasePercent/);
  });

  test("rejects negative challengesRemaining", () => {
    const input = makeDecisionInput(makeGameState({ challengesRemaining: -1 }));
    expect(() => validateChallengeDecisionInput(input)).toThrow(
      /challengesRemaining/
    );
  });
});
