import { computeSituationWeight } from "../features/situationWeight";
import { GameStateContext } from "../domain/gameContext.types";

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeGameState(
  overrides: Partial<GameStateContext> = {}
): GameStateContext {
  return {
    gamePk: 1,
    inning: 5,
    halfInning: "top",
    balls: 0,
    strikes: 0,
    outs: 0,
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
    challengesRemaining: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeSituationWeight", () => {
  describe("inning leverage", () => {
    test("9th inning produces higher leverage than 1st inning", () => {
      const early = computeSituationWeight(makeGameState({ inning: 1 }));
      const late = computeSituationWeight(makeGameState({ inning: 9 }));

      expect(late.weight).toBeGreaterThan(early.weight);
    });

    test("extra innings stay at maximum inning leverage", () => {
      const ninth = computeSituationWeight(makeGameState({ inning: 9 }));
      const tenth = computeSituationWeight(makeGameState({ inning: 10 }));
      const eleventh = computeSituationWeight(makeGameState({ inning: 11 }));

      // Extra innings should be at least as high as 9th
      expect(tenth.weight).toBeGreaterThanOrEqual(ninth.weight);
      expect(eleventh.weight).toBeGreaterThanOrEqual(ninth.weight);
      expect(tenth.components.isExtraInnings).toBe(true);
    });
  });

  describe("run differential leverage", () => {
    test("tie game has highest leverage", () => {
      const tied = computeSituationWeight(makeGameState({ runDifferentialForBattingTeam: 0 }));
      const oneRun = computeSituationWeight(makeGameState({ runDifferentialForBattingTeam: 1 }));

      expect(tied.components.runDiffLeverage).toBeGreaterThan(
        oneRun.components.runDiffLeverage
      );
    });

    test("blowout (≥5 run gap) produces lowest leverage", () => {
      const close = computeSituationWeight(makeGameState({ runDifferentialForBattingTeam: 0 }));
      const blowout = computeSituationWeight(
        makeGameState({ runDifferentialForBattingTeam: 6 })
      );

      expect(blowout.weight).toBeLessThan(close.weight);
      expect(blowout.components.isBlowout).toBe(true);
    });

    test("negative differential (team is trailing) has same leverage as equivalent positive", () => {
      const upThree = computeSituationWeight(
        makeGameState({ runDifferentialForBattingTeam: 3 })
      );
      const downThree = computeSituationWeight(
        makeGameState({ runDifferentialForBattingTeam: -3 })
      );

      expect(upThree.components.runDiffLeverage).toBeCloseTo(
        downThree.components.runDiffLeverage,
        5
      );
    });
  });

  describe("combined weight", () => {
    test("late-and-close scenario has highest weight", () => {
      const lateClose = computeSituationWeight(
        makeGameState({ inning: 9, runDifferentialForBattingTeam: 0 })
      );
      const earlyBlowout = computeSituationWeight(
        makeGameState({ inning: 2, runDifferentialForBattingTeam: 7 })
      );

      expect(lateClose.weight).toBeGreaterThan(earlyBlowout.weight);
      expect(lateClose.components.isLateAndClose).toBe(true);
    });

    test("weight is clamped to [0.30, 1.90]", () => {
      const anyState = computeSituationWeight(makeGameState());
      expect(anyState.weight).toBeGreaterThanOrEqual(0.30);
      expect(anyState.weight).toBeLessThanOrEqual(1.90);
    });
  });

  describe("challenge urgency", () => {
    test("9th inning with 2 challenges boosts weight vs same inning with none", () => {
      const withChallenges = computeSituationWeight(
        makeGameState({ inning: 9, challengesRemaining: 2 })
      );
      const withoutChallenges = computeSituationWeight(
        makeGameState({ inning: 9, challengesRemaining: 0 })
      );

      expect(withChallenges.components.challengeUrgency).toBeGreaterThan(1);
      expect(withChallenges.weight).toBeGreaterThan(withoutChallenges.weight);
    });

    test("challenge urgency does not apply before the 9th inning", () => {
      const result = computeSituationWeight(
        makeGameState({ inning: 8, challengesRemaining: 2 })
      );
      expect(result.components.challengeUrgency).toBe(1);
    });
  });

  describe("isLateAndClose flag", () => {
    test("set when inning >= 7 and run diff <= 2", () => {
      const result = computeSituationWeight(
        makeGameState({ inning: 8, runDifferentialForBattingTeam: -1 })
      );
      expect(result.components.isLateAndClose).toBe(true);
    });

    test("not set when run diff > 2", () => {
      const result = computeSituationWeight(
        makeGameState({ inning: 8, runDifferentialForBattingTeam: 3 })
      );
      expect(result.components.isLateAndClose).toBe(false);
    });
  });
});
