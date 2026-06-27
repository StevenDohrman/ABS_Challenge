import { computePlayerCredibility } from "../features/playerCredibility";
import { PlayerChallengeContext } from "../domain/playerContext.types";
import { PitchCallContext } from "../domain/pitchContext.types";
import { GameStateContext } from "../domain/gameContext.types";
import { LeagueAverages } from "../domain/leagueContext.types";
import { CREDIBILITY, LEAGUE_AVERAGES } from "../constants";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Default league averages (compile-time constants) passed explicitly so tests
// remain deterministic and don't silently pick up constant changes.
const defaultLeague: LeagueAverages = {
  chaseRate:     LEAGUE_AVERAGES.CHASE_RATE,
  walkRate:      LEAGUE_AVERAGES.WALK_RATE,
  strikeoutRate: LEAGUE_AVERAGES.STRIKEOUT_RATE,
  whiffRate:     LEAGUE_AVERAGES.WHIFF_RATE,
  ops:           LEAGUE_AVERAGES.OPS,
};

const baseGameState: GameStateContext = {
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
  challengesRemaining: 3,
};

const basePitchContext: PitchCallContext = {
  callType: "called_strike",
  pitcherHandedness: "R",
};

const disciplinedBatter: PlayerChallengeContext = {
  playerId: 100,
  battingHand: "R",
  obp: 0.380,
  ops: 0.900,
  walkRate: 0.14,        // well above league average (0.085)
  strikeoutRate: 0.17,   // well below league average (0.225)
  chasePercent: 0.18,    // elite — well below league average (0.30)
  whiffPercent: 0.18,    // elite — well below league average (0.25)
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

const aggressiveBatter: PlayerChallengeContext = {
  playerId: 101,
  battingHand: "R",
  obp: 0.290,
  ops: 0.720,
  walkRate: 0.05,        // well below league average
  strikeoutRate: 0.30,   // well above league average
  chasePercent: 0.42,    // very high — chases a lot
  whiffPercent: 0.35,    // well above league average (0.25)
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

const noDataBatter: PlayerChallengeContext = {
  playerId: 102,
  battingHand: null,
  obp: null,
  ops: null,
  walkRate: null,
  strikeoutRate: null,
  chasePercent: null,
  whiffPercent: null,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

// ---------------------------------------------------------------------------
// Basic ordering
// ---------------------------------------------------------------------------

describe("computePlayerCredibility", () => {
  test("disciplined batter has higher P(wrong) than aggressive batter", () => {
    const disciplined = computePlayerCredibility(
      disciplinedBatter,
      basePitchContext,
      baseGameState,
    defaultLeague
    );
    const aggressive = computePlayerCredibility(
      aggressiveBatter,
      basePitchContext,
      baseGameState,
    defaultLeague
    );

    expect(disciplined.pCallWasWrong).toBeGreaterThan(aggressive.pCallWasWrong);
  });

  test("result is clamped within [MIN_P_CALL_WRONG, MAX_P_CALL_WRONG]", () => {
    const disciplined = computePlayerCredibility(
      disciplinedBatter,
      basePitchContext,
      baseGameState,
    defaultLeague
    );
    const aggressive = computePlayerCredibility(
      aggressiveBatter,
      basePitchContext,
      baseGameState,
    defaultLeague
    );

    expect(disciplined.pCallWasWrong).toBeGreaterThanOrEqual(CREDIBILITY.MIN_P_CALL_WRONG);
    expect(disciplined.pCallWasWrong).toBeLessThanOrEqual(CREDIBILITY.MAX_P_CALL_WRONG);
    expect(aggressive.pCallWasWrong).toBeGreaterThanOrEqual(CREDIBILITY.MIN_P_CALL_WRONG);
    expect(aggressive.pCallWasWrong).toBeLessThanOrEqual(CREDIBILITY.MAX_P_CALL_WRONG);
  });

  // ---------------------------------------------------------------------------
  // Null data handling — the core of the user's question
  // ---------------------------------------------------------------------------

  describe("null data handling", () => {
    test("batter with no data falls back to BASE_P_CALL_WRONG ± modifiers", () => {
      const result = computePlayerCredibility(
        noDataBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      // With no discipline data, discipline score is 0 and handedness is unknown.
      // Only count modifier applies. In a 1-1 count the modifier is 0, so
      // the result should be exactly BASE_P_CALL_WRONG.
      expect(result.pCallWasWrong).toBeCloseTo(CREDIBILITY.BASE_P_CALL_WRONG, 3);
      expect(result.components.baselineDisciplineScore).toBe(0);
      expect(result.components.dataCompleteness).toBe(0);
    });

    test("dataCompleteness is 1.0 when all four signals are present", () => {
      const result = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      expect(result.components.dataCompleteness).toBeCloseTo(1.0, 5);
    });

    test("dataCompleteness reflects the fraction of signals that were available", () => {
      const partialBatter: PlayerChallengeContext = {
        ...noDataBatter,
        chasePercent: 0.25, // only this signal is present (weight 0.50)
      };

      const result = computePlayerCredibility(
        partialBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      // Only chase weight (0.50) out of total weight (1.0) is present
      expect(result.components.dataCompleteness).toBeCloseTo(
        CREDIBILITY.CHASE_WEIGHT / 1.0,
        5
      );
    });

    test("missing signals do NOT amplify the remaining signal", () => {
      // A batter with ONLY chase rate should NOT produce the same discipline
      // score as a batter who has chase rate AND all other signals agreeing.
      const onlyChase: PlayerChallengeContext = {
        ...noDataBatter,
        chasePercent: 0.15, // very elite chase rate
      };

      const allSignals: PlayerChallengeContext = {
        ...disciplinedBatter,
        chasePercent: 0.15,  // same chase rate
        walkRate: 0.14,      // also excellent
        strikeoutRate: 0.17, // also excellent
        whiffPercent: 0.18,  // also excellent
      };

      const onlyChaseResult = computePlayerCredibility(
        onlyChase,
        basePitchContext,
        baseGameState,
    defaultLeague
    );
      const allSignalsResult = computePlayerCredibility(
        allSignals,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      // With only chase rate, the discipline adjustment should be smaller
      // than when all four signals corroborate the same conclusion.
      expect(Math.abs(onlyChaseResult.components.baselineDisciplineScore)).toBeLessThan(
        Math.abs(allSignalsResult.components.baselineDisciplineScore)
      );
    });

    test("single weak signal (strikeoutRate only) has minimal influence", () => {
      const onlyKRate: PlayerChallengeContext = {
        ...noDataBatter,
        strikeoutRate: 0.40, // very high K rate — penalty signal
      };

      const result = computePlayerCredibility(
        onlyKRate,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      // Should be slightly below BASE_P_CALL_WRONG, but not dramatically so —
      // the single weak signal should not dominate the estimate.
      expect(result.pCallWasWrong).toBeLessThan(CREDIBILITY.BASE_P_CALL_WRONG);
      expect(result.pCallWasWrong).toBeGreaterThan(
        CREDIBILITY.BASE_P_CALL_WRONG - 0.05
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Historical accuracy blend
  // ---------------------------------------------------------------------------

  describe("historical accuracy", () => {
    test("strong historical success rate pushes credibility up", () => {
      const battleTested: PlayerChallengeContext = {
        ...disciplinedBatter,
        historicalChallengeAttempts: 30,
        historicalChallengeSuccessRate: 0.52,
      };

      const noHistory = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );
      const withHistory = computePlayerCredibility(
        battleTested,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      expect(withHistory.pCallWasWrong).toBeGreaterThan(noHistory.pCallWasWrong);
    });

    test("poor historical success rate lowers credibility even for a disciplined batter", () => {
      const poorHistory: PlayerChallengeContext = {
        ...disciplinedBatter,
        historicalChallengeAttempts: 25,
        historicalChallengeSuccessRate: 0.15,
      };

      const noHistory = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );
      const withPoorHistory = computePlayerCredibility(
        poorHistory,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      expect(withPoorHistory.pCallWasWrong).toBeLessThan(noHistory.pCallWasWrong);
    });

    test("fewer than HISTORY_MIN_ATTEMPTS is ignored", () => {
      const tooFewAttempts: PlayerChallengeContext = {
        ...disciplinedBatter,
        historicalChallengeAttempts: CREDIBILITY.HISTORY_MIN_ATTEMPTS - 1,
        historicalChallengeSuccessRate: 0.80, // high but ignored
      };

      const noAttempts = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        baseGameState,
    defaultLeague
    );
      const tooFew = computePlayerCredibility(
        tooFewAttempts,
        basePitchContext,
        baseGameState,
    defaultLeague
    );

      expect(tooFew.pCallWasWrong).toBeCloseTo(noAttempts.pCallWasWrong, 4);
      expect(tooFew.components.historicalBlendWeight).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Count modifier
  // ---------------------------------------------------------------------------

  describe("count modifier", () => {
    test("0-2 count raises credibility (pitcher working edges)", () => {
      const in02 = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        { ...baseGameState, balls: 0, strikes: 2 },
        defaultLeague
      );
      const in11 = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        { ...baseGameState, balls: 1, strikes: 1 },
        defaultLeague
      );

      expect(in02.pCallWasWrong).toBeGreaterThan(in11.pCallWasWrong);
    });

    test("3-0 count lowers credibility (pitcher throwing strikes)", () => {
      const in30 = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        { ...baseGameState, balls: 3, strikes: 0 },
        defaultLeague
      );
      const in11 = computePlayerCredibility(
        disciplinedBatter,
        basePitchContext,
        { ...baseGameState, balls: 1, strikes: 1 },
        defaultLeague
      );

      expect(in30.pCallWasWrong).toBeLessThan(in11.pCallWasWrong);
    });
  });

  // ---------------------------------------------------------------------------
  // Handedness modifier
  // ---------------------------------------------------------------------------

  describe("handedness modifier", () => {
    test("opposite-hand matchup has higher credibility than same-hand", () => {
      const rhbVsRhp: PitchCallContext = { callType: "called_strike", pitcherHandedness: "R" };
      const rhbVsLhp: PitchCallContext = { callType: "called_strike", pitcherHandedness: "L" };
      const rhb: PlayerChallengeContext = { ...disciplinedBatter, battingHand: "R" };

      const sameHand = computePlayerCredibility(rhb, rhbVsRhp, baseGameState, defaultLeague);
      const oppHand  = computePlayerCredibility(rhb, rhbVsLhp, baseGameState, defaultLeague);

      expect(oppHand.pCallWasWrong).toBeGreaterThan(sameHand.pCallWasWrong);
    });

    test("unknown batter hand returns no modifier", () => {
      const unknownHand: PlayerChallengeContext = {
        ...disciplinedBatter,
        battingHand: null,
      };
      const knownHand = { ...disciplinedBatter, battingHand: "R" as const };

      const unknown = computePlayerCredibility(unknownHand, basePitchContext, baseGameState, defaultLeague);
      const same    = computePlayerCredibility(knownHand,   basePitchContext, baseGameState, defaultLeague);

      expect(unknown.components.handednessModifier).toBe(0);
      // Known same-hand should have a negative modifier
      expect(same.components.handednessModifier).toBe(CREDIBILITY.SAME_HAND_MODIFIER);
    });
  });
});
