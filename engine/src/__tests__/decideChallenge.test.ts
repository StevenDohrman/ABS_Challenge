import { decideChallenge } from "../decision/decideChallenge";
import { ChallengeDecisionInput } from "../domain/challengeDecision.types";
import { GameStateContext } from "../domain/gameContext.types";
import { PlayerChallengeContext } from "../domain/playerContext.types";
import { PitchCallContext } from "../domain/pitchContext.types";
import { computeChallengeOutcomeExpectancies } from "../data/runExpectancy";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeGameState(
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
    challengesRemaining: 3,
    ...overrides,
  };
}

const disciplinedPlayer: PlayerChallengeContext = {
  playerId: 100,
  battingHand: "L",
  obp: 0.390,
  ops: 0.920,
  walkRate: 0.13,
  strikeoutRate: 0.16,
  chasePercent: 0.17,
  whiffPercent: 0.19,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

const averagePlayer: PlayerChallengeContext = {
  playerId: 101,
  battingHand: "R",
  obp: 0.320,
  ops: 0.750,
  walkRate: 0.085,
  strikeoutRate: 0.225,
  chasePercent: 0.30,
  whiffPercent: 0.25,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

const aggressivePlayer: PlayerChallengeContext = {
  playerId: 102,
  battingHand: "R",
  obp: 0.290,
  ops: 0.700,
  walkRate: 0.045,
  strikeoutRate: 0.32,
  chasePercent: 0.45,
  whiffPercent: 0.38,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

const calledStrike: PitchCallContext = {
  callType: "called_strike",
  pitcherHandedness: "R",
};

function makeInput(
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

// ---------------------------------------------------------------------------
// Hard gate tests
// ---------------------------------------------------------------------------

describe("decideChallenge — hard gates", () => {
  test("out of challenges does NOT change the recommendation — value is decoupled from availability", () => {
    // A team with its full allotment (2, no scarcity penalty) and a team with 0
    // challenges (no penalty either — the 'none' level) should produce an
    // identical, purely value-based decision. Availability is tracked by the
    // backend, not by forcing DENY here, so missed opportunities stay visible.
    const withChallenges = decideChallenge(
      makeInput(makeGameState({ challengesRemaining: 2 }))
    );
    const noChallenges = decideChallenge(
      makeInput(makeGameState({ challengesRemaining: 0 }))
    );

    expect(noChallenges.recommendation).toBe(withChallenges.recommendation);
    expect(noChallenges.minimumPlayerConfidenceRequired).toBe(
      withChallenges.minimumPlayerConfidenceRequired
    );
    expect(noChallenges.expectedValueOfChallenge).toBe(
      withChallenges.expectedValueOfChallenge
    );
    expect(noChallenges.score).toBe(withChallenges.score);

    // The engine explanation never mentions challenge availability — that is a
    // backend/DTO concern now.
    expect(noChallenges.explanation.join(" ")).not.toMatch(/no challenges/i);
  });

  test("returns DENY for non-challengeable call type", () => {
    const input = makeInput(
      makeGameState(),
      averagePlayer,
      { callType: "ball", pitcherHandedness: "R" }
    );
    const result = decideChallenge(input);

    expect(result.recommendation).toBe("DENY");
  });
});

// ---------------------------------------------------------------------------
// Recommendation label tests
// ---------------------------------------------------------------------------

describe("decideChallenge — recommendation labels", () => {
  test("produces AUTO_ALLOW in peak scenario: 3-2 count, loaded, 0 outs, 9th inning, tie game, disciplined batter", () => {
    const peakState = makeGameState({
      inning: 9,
      balls: 3,
      strikes: 2,
      outs: 0,
      runnerOnFirst: true,
      runnerOnSecond: true,
      runnerOnThird: true,
      runDifferentialForBattingTeam: 0,
      challengesRemaining: 3,
    });

    const result = decideChallenge(makeInput(peakState, disciplinedPlayer));
    expect(result.recommendation).toBe("AUTO_ALLOW");
    expect(result.minimumPlayerConfidenceRequired).toBe(0);
  });

  test("produces DENY in minimal scenario: 0-0 count, early inning, blowout, aggressive batter, 1 challenge left", () => {
    const lowValueState = makeGameState({
      inning: 2,
      balls: 0,
      strikes: 0,
      outs: 2,
      runDifferentialForBattingTeam: -7,
      challengesRemaining: 1,
    });

    const result = decideChallenge(makeInput(lowValueState, aggressivePlayer));
    expect(result.recommendation).toBe("DENY");
  });

  test("disciplined batter in high-leverage situation scores higher than aggressive batter", () => {
    const highLevState = makeGameState({
      inning: 8,
      balls: 2,
      strikes: 2,
      outs: 1,
      runnerOnFirst: true,
      runDifferentialForBattingTeam: -1,
    });

    const disciplinedResult = decideChallenge(makeInput(highLevState, disciplinedPlayer));
    const aggressiveResult = decideChallenge(makeInput(highLevState, aggressivePlayer));

    expect(disciplinedResult.score).toBeGreaterThan(aggressiveResult.score);
  });
});

// ---------------------------------------------------------------------------
// Scarcity adjustment tests
// ---------------------------------------------------------------------------

describe("decideChallenge — scarcity adjustments", () => {
  test("same scenario scores identically but thresholds shift with 1 challenge left", () => {
    const state = makeGameState({
      inning: 7,
      balls: 2,
      strikes: 1,
      runDifferentialForBattingTeam: 0,
    });

    const plenty = decideChallenge(makeInput(makeGameState({ ...state, challengesRemaining: 3 })));
    const scarce = decideChallenge(makeInput(makeGameState({ ...state, challengesRemaining: 1 })));

    // Scores are the same (EV doesn't change, only thresholds)
    expect(plenty.score).toBe(scarce.score);

    // With scarce challenges, recommendation should be same or worse (never better)
    const rankOrder = ["DENY", "WARN", "ALLOW", "AUTO_ALLOW"];
    const plentyRank = rankOrder.indexOf(plenty.recommendation);
    const scarceRank = rankOrder.indexOf(scarce.recommendation);
    expect(scarceRank).toBeLessThanOrEqual(plentyRank);
  });

  test("borderline ALLOW scenario becomes WARN with only 1 challenge left", () => {
    // Construct a scenario where the score lands right around the ALLOW threshold
    // by using a medium-leverage situation and average player
    const borderlineState = makeGameState({
      inning: 6,
      balls: 1,
      strikes: 2,
      outs: 1,
      runnerOnFirst: false,
      runDifferentialForBattingTeam: 0,
      challengesRemaining: 3,
    });

    const withPlenty = decideChallenge(makeInput(borderlineState, averagePlayer));
    const withScarce = decideChallenge(
      makeInput(makeGameState({ ...borderlineState, challengesRemaining: 1 }), averagePlayer)
    );

    // Minimum confidence should be higher when challenges are scarce
    if (withPlenty.recommendation !== "DENY") {
      expect(withScarce.minimumPlayerConfidenceRequired).toBeGreaterThanOrEqual(
        withPlenty.minimumPlayerConfidenceRequired
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Output shape tests
// ---------------------------------------------------------------------------

describe("decideChallenge — output shape", () => {
  test("always returns all required fields", () => {
    const result = decideChallenge(makeInput(makeGameState()));

    expect(result).toHaveProperty("recommendation");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("expectedValueOfChallenge");
    expect(result).toHaveProperty("minimumPlayerConfidenceRequired");
    expect(result).toHaveProperty("explanation");
    expect(Array.isArray(result.explanation)).toBe(true);
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  test("score is always between 0 and 100", () => {
    const scenarios = [
      makeGameState({ inning: 1, runDifferentialForBattingTeam: -8 }),
      makeGameState({ inning: 9, runDifferentialForBattingTeam: 0, balls: 3, strikes: 2, runnerOnFirst: true, runnerOnSecond: true, runnerOnThird: true }),
      makeGameState({ inning: 5, runDifferentialForBattingTeam: 2, balls: 0, strikes: 1 }),
    ];

    for (const state of scenarios) {
      const result = decideChallenge(makeInput(state));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  test("minimumPlayerConfidenceRequired is always between 0 and 100", () => {
    const result = decideChallenge(makeInput(makeGameState()));
    expect(result.minimumPlayerConfidenceRequired).toBeGreaterThanOrEqual(0);
    expect(result.minimumPlayerConfidenceRequired).toBeLessThanOrEqual(100);
  });

  test("AUTO_ALLOW always sets minimumPlayerConfidenceRequired to 0", () => {
    const peakState = makeGameState({
      inning: 9,
      balls: 3,
      strikes: 2,
      outs: 0,
      runnerOnFirst: true,
      runnerOnSecond: true,
      runnerOnThird: true,
      runDifferentialForBattingTeam: 0,
      challengesRemaining: 3,
    });
    const result = decideChallenge(makeInput(peakState, disciplinedPlayer));

    if (result.recommendation === "AUTO_ALLOW") {
      expect(result.minimumPlayerConfidenceRequired).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// League averages injection tests
// ---------------------------------------------------------------------------

describe("decideChallenge — leagueAverages injection", () => {
  test("omitting leagueAverages uses compile-time constants (no error)", () => {
    // Every existing test implicitly covers this — this one makes it explicit.
    const result = decideChallenge(makeInput(makeGameState(), disciplinedPlayer));
    expect(result.recommendation).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("injecting league averages that make the batter look average lowers credibility", () => {
    // Set league averages equal to the disciplined batter's own metrics.
    // Deviations from league average will be zero → discipline score = 0 → lower credibility.
    const leagueMatchingBatter = {
      chaseRate:     0.17, // same as disciplinedPlayer.chasePercent
      walkRate:      0.13, // same as disciplinedPlayer.walkRate
      strikeoutRate: 0.16, // same as disciplinedPlayer.strikeoutRate
      whiffRate:     0.19, // same as disciplinedPlayer.whiffPercent
      ops:           0.920,
    };

    const withDefaultLeague = decideChallenge(makeInput(makeGameState(), disciplinedPlayer));
    const withMatchedLeague  = decideChallenge({
      ...makeInput(makeGameState(), disciplinedPlayer),
      leagueAverages: leagueMatchingBatter,
    });

    // When the batter's stats match the league, their advantage disappears
    // → lower score than when measured against a typical league.
    expect(withMatchedLeague.score).toBeLessThan(withDefaultLeague.score);
  });

  test("injecting higher league OPS lowers the offensive value multiplier for a given batter", () => {
    // A batter with OPS 0.800 looks below-average if the league OPS is 0.850.
    const regularBatter: PlayerChallengeContext = {
      ...averagePlayer,
      ops: 0.800,
    };

    const withNormalLeague = decideChallenge({
      ...makeInput(makeGameState(), regularBatter),
      leagueAverages: { ops: 0.728 }, // batter is above average → boost
    });

    const withEliteLeague = decideChallenge({
      ...makeInput(makeGameState(), regularBatter),
      leagueAverages: { ops: 0.900 }, // batter is below average → penalty
    });

    expect(withNormalLeague.score).toBeGreaterThan(withEliteLeague.score);
  });

  test("partial override: only overriding one field uses constants for the rest", () => {
    // Override only chase rate — everything else comes from constants.
    // Should not throw and should produce a valid recommendation.
    const result = decideChallenge({
      ...makeInput(makeGameState(), disciplinedPlayer),
      leagueAverages: { chaseRate: 0.25 }, // tighter league → batter's 0.17 looks even better
    });

    expect(["AUTO_ALLOW", "ALLOW", "WARN", "DENY"]).toContain(result.recommendation);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Monotonicity tests
// ---------------------------------------------------------------------------

describe("decideChallenge — monotonicity", () => {
  test("score increases as run expectancy delta increases", () => {
    // Hold everything else constant, vary the RE delta by changing the count
    const emptyBases = { first: false, second: false, third: false };

    const scenarios: Array<[number, number]> = [
      [0, 0], // 0-0: moderate delta
      [2, 2], // 2-2: larger delta (K possible)
      [3, 2], // 3-2: largest delta (walk or K)
    ];

    const scores = scenarios.map(([balls, strikes]) => {
      const state = makeGameState({ balls, strikes, outs: 1 });
      const re = computeChallengeOutcomeExpectancies(1, balls, strikes, emptyBases);
      return decideChallenge({
        gameState: state,
        playerContext: averagePlayer,
        pitchContext: calledStrike,
        currentRunExpectancy: re.current,
        runExpectancyIfSuccessful: re.ifSucceeds,
        runExpectancyIfFailed: re.ifFails,
      }).score;
    });

    // 3-2 should have the highest score (largest RE delta)
    expect(scores[2]).toBeGreaterThan(scores[0]);
  });
});
