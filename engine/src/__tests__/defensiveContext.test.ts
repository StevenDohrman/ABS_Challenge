import { computeDefensiveContext } from "../features/defensiveContext";
import { decideChallenge } from "../decision/decideChallenge";
import { computeChallengeOutcomeExpectancies } from "../data/runExpectancy";
import { PlayerChallengeContext } from "../domain/playerContext.types";
import { ChallengeDecisionInput } from "../domain/challengeDecision.types";
import { GameStateContext } from "../domain/gameContext.types";
import { DEFENSIVE } from "../constants";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const testLeague = {
  gbRate: DEFENSIVE.LEAGUE_AVG_GB_RATE,
  fbRate: DEFENSIVE.LEAGUE_AVG_FB_RATE,
  ldRate: DEFENSIVE.LEAGUE_AVG_LD_RATE,
};

function makePlayer(
  sprayProfile: PlayerChallengeContext["sprayProfile"],
  fielderOaa: number | null = null
): PlayerChallengeContext {
  return {
    playerId: 1,
    battingHand: "R",
    obp: 0.330,
    ops: 0.750,
    walkRate: 0.085,
    strikeoutRate: 0.225,
    chasePercent: 0.30,
    whiffPercent: 0.25,
    historicalChallengeAttempts: 0,
    historicalChallengeSuccessRate: null,
    sprayProfile,
    fielderOaa,
  };
}

const leagueAvgSpray: PlayerChallengeContext["sprayProfile"] = {
  pullPercent: 0.40,
  straightawayPercent: 0.37,
  oppoPercent: 0.23,
  gbPercent: DEFENSIVE.LEAGUE_AVG_GB_RATE,
  fbPercent: DEFENSIVE.LEAGUE_AVG_FB_RATE,
  ldPercent: DEFENSIVE.LEAGUE_AVG_LD_RATE,
};

// A strongly ground-ball oriented hitter — the most defense-favourable profile.
const heavyGbSpray: PlayerChallengeContext["sprayProfile"] = {
  pullPercent: 0.45,
  straightawayPercent: 0.35,
  oppoPercent: 0.20,
  gbPercent: 0.60,  // 16 pp above league avg
  fbPercent: 0.20,  // 13 pp below league avg
  ldPercent: 0.20,  // 3 pp below league avg
};

// A strong fly-ball/line-drive hitter — the most offense-favourable profile.
const heavyLdFbSpray: PlayerChallengeContext["sprayProfile"] = {
  pullPercent: 0.38,
  straightawayPercent: 0.37,
  oppoPercent: 0.25,
  gbPercent: 0.32,  // 12 pp below league avg
  fbPercent: 0.40,  // 7 pp above league avg
  ldPercent: 0.28,  // 5 pp above league avg
};

// ---------------------------------------------------------------------------
// Null safety — no spray data
// ---------------------------------------------------------------------------

describe("computeDefensiveContext — null safety", () => {
  test("returns 1.0× multiplier when sprayProfile is null and fielderOaa is null", () => {
    const result = computeDefensiveContext(makePlayer(null), testLeague);
    expect(result.multiplier).toBe(1.0);
    expect(result.sprayDataAvailable).toBe(false);
    expect(result.fielderOaaAvailable).toBe(false);
  });

  test("returns 1.0× multiplier with all null spray fields and no OAA", () => {
    const result = computeDefensiveContext(makePlayer({
        pullPercent: null,
        straightawayPercent: null,
        oppoPercent: null,
        gbPercent: null,
        fbPercent: null,
        ldPercent: null,
      })
    , testLeague);
    expect(result.multiplier).toBe(1.0);
    expect(result.sprayDataAvailable).toBe(true);
  });

  test("partial null fields use only available components", () => {
    // Only gbPercent available — should apply a GB-only adjustment
    const result = computeDefensiveContext(makePlayer({
        pullPercent: null,
        straightawayPercent: null,
        oppoPercent: null,
        gbPercent: 0.55,  // 11 pp above avg → penalty
        fbPercent: null,
        ldPercent: null,
      })
    , testLeague);
    expect(result.multiplier).toBeLessThan(1.0);
    expect(result.sprayDataAvailable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Direction of effect — spray component
// ---------------------------------------------------------------------------

describe("computeDefensiveContext — spray direction of effect", () => {
  test("league-average spray produces multiplier ≈ 1.0", () => {
    const result = computeDefensiveContext(makePlayer(leagueAvgSpray), testLeague);
    expect(result.multiplier).toBeCloseTo(1.0, 3);
  });

  test("heavy GB hitter yields a multiplier below 1.0 (defense-favourable)", () => {
    const result = computeDefensiveContext(makePlayer(heavyGbSpray), testLeague);
    expect(result.multiplier).toBeLessThan(1.0);
  });

  test("heavy LD/FB hitter yields a multiplier above 1.0 (offense-favourable)", () => {
    const result = computeDefensiveContext(makePlayer(heavyLdFbSpray), testLeague);
    expect(result.multiplier).toBeGreaterThan(1.0);
  });

  test("heavy GB hitter multiplier is lower than heavy LD/FB hitter", () => {
    const gbResult = computeDefensiveContext(makePlayer(heavyGbSpray), testLeague);
    const ldResult = computeDefensiveContext(makePlayer(heavyLdFbSpray), testLeague);
    expect(gbResult.multiplier).toBeLessThan(ldResult.multiplier);
  });
});

// ---------------------------------------------------------------------------
// Fielder OAA component
// ---------------------------------------------------------------------------

describe("computeDefensiveContext — fielder OAA", () => {
  test("fielderOaa null → same multiplier as OAA=0 (no adjustment)", () => {
    const withNull = computeDefensiveContext(makePlayer(leagueAvgSpray, null), testLeague);
    const withZero = computeDefensiveContext(makePlayer(leagueAvgSpray, 0), testLeague);
    expect(withNull.multiplier).toBeCloseTo(withZero.multiplier, 5);
  });

  test("positive OAA (elite defender) decreases multiplier — fewer hits expected", () => {
    const noOaa = computeDefensiveContext(makePlayer(leagueAvgSpray, null), testLeague);
    const eliteOaa = computeDefensiveContext(makePlayer(leagueAvgSpray, 15), testLeague);
    expect(eliteOaa.multiplier).toBeLessThan(noOaa.multiplier);
  });

  test("negative OAA (poor defender) increases multiplier — more hits expected", () => {
    const noOaa = computeDefensiveContext(makePlayer(leagueAvgSpray, null), testLeague);
    const poorOaa = computeDefensiveContext(makePlayer(leagueAvgSpray, -15), testLeague);
    expect(poorOaa.multiplier).toBeGreaterThan(noOaa.multiplier);
  });

  test("+15 OAA produces approximately 6% penalty on the multiplier", () => {
    const base = computeDefensiveContext(makePlayer(leagueAvgSpray, null), testLeague);
    const elite = computeDefensiveContext(makePlayer(leagueAvgSpray, 15), testLeague);
    // 15 * OAA_SCALE = 15 * 0.004 = 0.06 → ~6% reduction
    const expectedOaaAdj = -15 * DEFENSIVE.OAA_SCALE;
    expect(elite.multiplier).toBeCloseTo(base.multiplier + expectedOaaAdj, 4);
  });

  test("-15 OAA produces approximately 6% boost on the multiplier", () => {
    const base = computeDefensiveContext(makePlayer(leagueAvgSpray, null), testLeague);
    const poor = computeDefensiveContext(makePlayer(leagueAvgSpray, -15), testLeague);
    const expectedOaaAdj = 15 * DEFENSIVE.OAA_SCALE;
    expect(poor.multiplier).toBeCloseTo(base.multiplier + expectedOaaAdj, 4);
  });

  test("OAA component stacks additively with spray component", () => {
    const sprayOnly = computeDefensiveContext(makePlayer(heavyGbSpray, null), testLeague);
    const sprayAndOaa = computeDefensiveContext(makePlayer(heavyGbSpray, -10), testLeague);
    // Poor defender on top of GB-heavy spray → multiplier should be higher
    expect(sprayAndOaa.multiplier).toBeGreaterThan(sprayOnly.multiplier);
  });

  test("fielderOaaAvailable is true when fielderOaa is provided", () => {
    const result = computeDefensiveContext(makePlayer(null, 5), testLeague);
    expect(result.fielderOaaAvailable).toBe(true);
  });

  test("fielderOaaAvailable is false when fielderOaa is null", () => {
    const result = computeDefensiveContext(makePlayer(null, null), testLeague);
    expect(result.fielderOaaAvailable).toBe(false);
  });

  test("fielderOaa alone (no spray) still shifts multiplier from 1.0", () => {
    const withOaa = computeDefensiveContext(makePlayer(null, 10), testLeague);
    // 10 * 0.004 = 0.04 penalty from league-average 1.0
    expect(withOaa.multiplier).toBeCloseTo(0.96, 4);
  });
});

// ---------------------------------------------------------------------------
// Magnitude of effect (±5–10% target range)
// ---------------------------------------------------------------------------

describe("computeDefensiveContext — magnitude", () => {
  test("heavy GB hitter shows ≥5% penalty from league average", () => {
    const leagueResult = computeDefensiveContext(makePlayer(leagueAvgSpray), testLeague);
    const gbResult = computeDefensiveContext(makePlayer(heavyGbSpray), testLeague);
    const pctDiff = (leagueResult.multiplier - gbResult.multiplier) / leagueResult.multiplier;
    expect(pctDiff).toBeGreaterThanOrEqual(0.05);
  });

  test("heavy LD/FB hitter shows ≥5% boost from league average", () => {
    const leagueResult = computeDefensiveContext(makePlayer(leagueAvgSpray), testLeague);
    const ldResult = computeDefensiveContext(makePlayer(heavyLdFbSpray), testLeague);
    const pctDiff = (ldResult.multiplier - leagueResult.multiplier) / leagueResult.multiplier;
    expect(pctDiff).toBeGreaterThanOrEqual(0.05);
  });

  test("multiplier is always clamped to [MIN_MULTIPLIER, MAX_MULTIPLIER]", () => {
    // Extreme profile: pure GB hitter against an elite defender
    const extremeGb = computeDefensiveContext(makePlayer({
        pullPercent: 0.50,
        straightawayPercent: 0.30,
        oppoPercent: 0.20,
        gbPercent: 0.80,
        fbPercent: 0.10,
        ldPercent: 0.10,
      }, 25)
    , testLeague);
    expect(extremeGb.multiplier).toBeGreaterThanOrEqual(DEFENSIVE.MIN_MULTIPLIER);
    expect(extremeGb.multiplier).toBeLessThanOrEqual(DEFENSIVE.MAX_MULTIPLIER);

    // Extreme profile: all LD against a terrible defender
    const extremeLd = computeDefensiveContext(makePlayer({
        pullPercent: 0.40,
        straightawayPercent: 0.35,
        oppoPercent: 0.25,
        gbPercent: 0.20,
        fbPercent: 0.30,
        ldPercent: 0.50,
      }, -25)
    , testLeague);
    expect(extremeLd.multiplier).toBeGreaterThanOrEqual(DEFENSIVE.MIN_MULTIPLIER);
    expect(extremeLd.multiplier).toBeLessThanOrEqual(DEFENSIVE.MAX_MULTIPLIER);
  });

  test("multiplier is never exactly 0", () => {
    const result = computeDefensiveContext(makePlayer(heavyGbSpray), testLeague);
    expect(result.multiplier).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: defensive context modifies decideChallenge output
// ---------------------------------------------------------------------------

function makeInput(
  sprayProfile: PlayerChallengeContext["sprayProfile"],
  fielderOaa: number | null = null
): ChallengeDecisionInput {
  const gameState: GameStateContext = {
    gamePk: 1,
    inning: 5,
    halfInning: "top",
    balls: 2,
    strikes: 2,
    outs: 1,
    runnerOnFirst: true,
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
  };

  const { current, ifSucceeds, ifFails } = computeChallengeOutcomeExpectancies(
    gameState.outs,
    gameState.balls,
    gameState.strikes,
    { first: gameState.runnerOnFirst, second: gameState.runnerOnSecond, third: gameState.runnerOnThird }
  );

  return {
    gameState,
    playerContext: makePlayer(sprayProfile, fielderOaa),
    pitchContext: { callType: "called_strike", pitcherHandedness: "R" },
    currentRunExpectancy: current,
    runExpectancyIfSuccessful: ifSucceeds,
    runExpectancyIfFailed: ifFails,
  };
}

describe("defensive context integration with decideChallenge", () => {
  test("null spray profile produces the same score as league-average spray", () => {
    const nullResult = decideChallenge(makeInput(null));
    const avgResult = decideChallenge(makeInput(leagueAvgSpray));
    // League-average spray → multiplier ≈ 1.0 → virtually identical to null
    expect(Math.abs(nullResult.score - avgResult.score)).toBeLessThanOrEqual(1);
  });

  test("heavy GB hitter scores lower than heavy LD/FB hitter", () => {
    const gbResult = decideChallenge(makeInput(heavyGbSpray));
    const ldResult = decideChallenge(makeInput(heavyLdFbSpray));
    expect(gbResult.score).toBeLessThan(ldResult.score);
  });

  test("heavy GB hitter scores lower than the same player with null spray", () => {
    const noSprayResult = decideChallenge(makeInput(null));
    const gbResult = decideChallenge(makeInput(heavyGbSpray));
    expect(gbResult.score).toBeLessThan(noSprayResult.score);
  });

  test("heavy LD/FB hitter scores higher than the same player with null spray", () => {
    const noSprayResult = decideChallenge(makeInput(null));
    const ldResult = decideChallenge(makeInput(heavyLdFbSpray));
    expect(ldResult.score).toBeGreaterThan(noSprayResult.score);
  });

  test("elite defender (+15 OAA) lowers score vs the same batter against avg defender", () => {
    const avgDefenseResult = decideChallenge(makeInput(leagueAvgSpray, 0));
    const eliteDefenseResult = decideChallenge(makeInput(leagueAvgSpray, 15));
    expect(eliteDefenseResult.score).toBeLessThan(avgDefenseResult.score);
  });

  test("poor defender (-15 OAA) raises score vs the same batter against avg defender", () => {
    const avgDefenseResult = decideChallenge(makeInput(leagueAvgSpray, 0));
    const poorDefenseResult = decideChallenge(makeInput(leagueAvgSpray, -15));
    expect(poorDefenseResult.score).toBeGreaterThan(avgDefenseResult.score);
  });
});
