import { prisma } from "./prisma";
import type { ChallengeDecision } from "@abs/engine";
import type { ChallengeRecommendation } from "@prisma/client";

export type { ChallengeRecommendation };

// ─────────────────────────────────────────────────────────────────────────────
// challenge_recommendations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input required to write a pre-computed recommendation for one count state.
 */
export interface WriteRecommendationInput {
  gamePk: number;
  atBatIndex: number;
  balls: number;
  strikes: number;
  decision: ChallengeDecision;
}

/**
 * Write (or overwrite) a pre-computed recommendation for a specific count state.
 * Called for all 12 count states when a new at-bat starts.
 *
 * The unique key is (gamePk, atBatIndex, balls, strikes). If the at-bat is
 * re-processed (e.g. after a pipeline restart), the existing row is refreshed
 * with the latest engine output.
 */
export async function upsertRecommendation(
  input: WriteRecommendationInput
): Promise<ChallengeRecommendation> {
  const sharedFields = {
    recommendation: input.decision.recommendation,
    minimumConfidenceRequired: input.decision.minimumPlayerConfidenceRequired,
    expectedValue: input.decision.expectedValueOfChallenge,
    score: input.decision.score,
    explanationJson: input.decision.explanation as object,
  };

  return prisma.challengeRecommendation.upsert({
    where: {
      gamePk_atBatIndex_balls_strikes: {
        gamePk: input.gamePk,
        atBatIndex: input.atBatIndex,
        balls: input.balls,
        strikes: input.strikes,
      },
    },
    update: {
      ...sharedFields,
      // Reset triggeredAt so the old trigger doesn't persist after a recompute.
      triggeredAt: null,
      pitchEventId: null,
    },
    create: {
      gamePk: input.gamePk,
      atBatIndex: input.atBatIndex,
      balls: input.balls,
      strikes: input.strikes,
      ...sharedFields,
    },
  });
}

/**
 * Mark a pre-computed recommendation as "triggered" by an actual called-strike
 * pitch event. This is the signal that makes it the active recommendation the
 * frontend should display.
 */
export async function markRecommendationTriggered(
  gamePk: number,
  atBatIndex: number,
  balls: number,
  strikes: number,
  pitchEventId: number
): Promise<void> {
  await prisma.challengeRecommendation.updateMany({
    where: { gamePk, atBatIndex, balls, strikes },
    data: {
      triggeredAt: new Date(),
      pitchEventId,
    },
  });
}

/**
 * Returns the most recently triggered recommendation for a game.
 * This is what the frontend polls to display the current challenge decision.
 * Returns null when no recommendation has been triggered yet.
 */
export async function findLatestTriggeredRecommendation(
  gamePk: number
): Promise<ChallengeRecommendation | null> {
  return prisma.challengeRecommendation.findFirst({
    where: { gamePk, triggeredAt: { not: null } },
    orderBy: { triggeredAt: "desc" },
  });
}

/**
 * Fetch the pre-computed recommendation for a specific count state.
 * Used to look up the recommendation when a pitch event arrives.
 */
export async function findRecommendation(
  gamePk: number,
  atBatIndex: number,
  balls: number,
  strikes: number
): Promise<ChallengeRecommendation | null> {
  return prisma.challengeRecommendation.findUnique({
    where: {
      gamePk_atBatIndex_balls_strikes: { gamePk, atBatIndex, balls, strikes },
    },
  });
}

/**
 * Returns all 12 pre-computed recommendations for a specific at-bat.
 * Used by the pre-at-bat banner to show the full count-state grid.
 */
export async function findAllForAtBat(
  gamePk: number,
  atBatIndex: number
): Promise<ChallengeRecommendation[]> {
  return prisma.challengeRecommendation.findMany({
    where: { gamePk, atBatIndex },
    orderBy: [{ balls: "asc" }, { strikes: "asc" }],
  });
}

/**
 * Returns all pre-computed recommendations for every at-bat in a game.
 * Used by the post-game at-bat history view.
 */
export async function findAllForGame(
  gamePk: number
): Promise<ChallengeRecommendation[]> {
  return prisma.challengeRecommendation.findMany({
    where: { gamePk },
    orderBy: [{ atBatIndex: "asc" }, { balls: "asc" }, { strikes: "asc" }],
  });
}

/**
 * Returns true if any recommendation for this game has been triggered.
 * Used to annotate games in the schedule response.
 */
export async function gameHasTriggeredRecommendation(
  gamePk: number
): Promise<boolean> {
  const row = await prisma.challengeRecommendation.findFirst({
    where: { gamePk, triggeredAt: { not: null } },
    select: { id: true },
  });
  return row !== null;
}
