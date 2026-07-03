import { buildExplanation } from "../decision/explanation";
import { applyThresholds } from "../decision/thresholds";
import { computeChallengeScarcity } from "../features/challengeScarcity";
import { computePlayerCredibility } from "../features/playerCredibility";
import { computeBaserunningContext } from "../features/baserunningContext";
import { computeLineupContext } from "../features/lineupContext";
import { computeSituationWeight } from "../features/situationWeight";
import { makeGameState } from "./fixtures/gameState";
import { calledStrike } from "./fixtures/makeDecisionInput";
import { averagePlayer, disciplinedPlayer } from "./fixtures/players";
import { defaultLeague } from "./fixtures/league";

describe("buildExplanation", () => {
  const gameState = makeGameState({ balls: 2, strikes: 1, inning: 8 });

  function buildFromInput(recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY", score: number) {
    const scarcity = computeChallengeScarcity(gameState.challengesRemaining);
    const thresholdResult = {
      ...applyThresholds(score, scarcity),
      recommendation,
    };

    return buildExplanation({
      recommendation,
      score,
      reDelta: 0.12,
      adjustedEV: 0.04,
      credibility: computePlayerCredibility(
        disciplinedPlayer,
        calledStrike,
        gameState,
        defaultLeague
      ),
      baserunning: computeBaserunningContext(gameState, undefined),
      lineupContext: computeLineupContext(undefined, defaultLeague),
      situation: computeSituationWeight(gameState),
      scarcity,
      thresholdResult,
      balls: gameState.balls,
      strikes: gameState.strikes,
      inning: gameState.inning,
      halfInning: gameState.halfInning,
    });
  }

  test("returns non-empty sentences for each recommendation", () => {
    for (const rec of ["AUTO_ALLOW", "ALLOW", "WARN", "DENY"] as const) {
      const sentences = buildFromInput(rec, rec === "AUTO_ALLOW" ? 80 : rec === "ALLOW" ? 55 : rec === "WARN" ? 35 : 10);
      expect(sentences.length).toBeGreaterThan(0);
      expect(sentences.every((s) => s.length > 0)).toBe(true);
    }
  });

  test("AUTO_ALLOW includes confidence-free endorsement", () => {
    const sentences = buildFromInput("AUTO_ALLOW", 80);
    expect(sentences.some((s) => s.includes("regardless of player confidence"))).toBe(true);
  });

  test("DENY states no confidence justifies challenge", () => {
    const sentences = buildFromInput("DENY", 10);
    expect(sentences.some((s) => s.includes("No level of player confidence"))).toBe(true);
  });

  test("scarce challenges produce scarcity warning", () => {
    const scarceState = makeGameState({ challengesRemaining: 1, balls: 2, strikes: 1 });
    const scarcity = computeChallengeScarcity(1);
    const thresholdResult = applyThresholds(55, scarcity);

    const sentences = buildExplanation({
      recommendation: thresholdResult.recommendation,
      score: 55,
      reDelta: 0.12,
      adjustedEV: 0.04,
      credibility: computePlayerCredibility(
        averagePlayer,
        calledStrike,
        scarceState,
        defaultLeague
      ),
      baserunning: computeBaserunningContext(scarceState, undefined),
      lineupContext: computeLineupContext(undefined, defaultLeague),
      situation: computeSituationWeight(scarceState),
      scarcity,
      thresholdResult,
      balls: scarceState.balls,
      strikes: scarceState.strikes,
      inning: scarceState.inning,
      halfInning: scarceState.halfInning,
    });

    expect(sentences.some((s) => s.includes("1 challenge remaining"))).toBe(true);
  });
});
