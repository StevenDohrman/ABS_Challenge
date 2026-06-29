/**
 * Shared fixture builders for backend tests.
 *
 * Each builder accepts a partial override so tests only specify the fields
 * relevant to what they are asserting. All other fields default to sensible
 * values that satisfy TypeScript without interfering with assertions.
 *
 * Naming convention: make<ModelName>(overrides?)
 */

import type {
  Game,
  LiveGameSnapshot,
  LivePitchEvent,
  PlayerStatSnapshot,
  ChallengeRecommendation,
} from "@prisma/client";
import type { MlbAtBatSnapshot, MlbLivePitchEvent, ActiveGame } from "@abs/data-pipeline";
import { SEASONS, CALL_CODES } from "../../db/constants";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma model fixtures
// ─────────────────────────────────────────────────────────────────────────────

export function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    gamePk: 824991,
    gameDate: "2026-06-22",
    homeTeamId: 133,
    awayTeamId: 134,
    status: "Live",
    homeChallengesRemaining: 2,
    awayChallengesRemaining: 2,
    savantEnrichedAt: null,
    finalizedAt: null,
    savantEnrichmentStartedAt: null,
    savantEnrichmentAttempts: 0,
    createdAt: new Date("2026-06-22T20:00:00Z"),
    updatedAt: new Date("2026-06-22T20:00:00Z"),
    ...overrides,
  };
}

export function makeLiveGameSnapshot(
  overrides: Partial<LiveGameSnapshot> = {}
): LiveGameSnapshot {
  return {
    id: 1,
    gamePk: 824991,
    atBatIndex: 5,
    inning: 7,
    halfInning: "bottom",
    outs: 1,
    runnerOnFirst: false,
    runnerOnSecond: false,
    runnerOnThird: false,
    homeScore: 3,
    awayScore: 3,
    batterId: 682998,
    pitcherId: 656731,
    battingTeamId: 133,
    fieldingTeamId: 134,
    fetchedAt: new Date("2026-06-22T21:00:00Z"),
    rawPayload: {},
    ...overrides,
  };
}

export function makePlayerStatSnapshot(
  overrides: Partial<PlayerStatSnapshot> = {}
): PlayerStatSnapshot {
  return {
    id: 1,
    playerId: 682998,
    playerName: "Jacob Wilson",
    season: SEASONS.CURRENT,
    battingHand: "R",
    pa: 350,
    ba: 0.275,
    obp: 0.350,
    slg: 0.440,
    ops: 0.790,
    woba: 0.340,
    xba: 0.260,
    xslg: 0.420,
    xwoba: 0.330,
    // Savant percentages (0–100 range)
    kPercent: 20.5,
    bbPercent: 9.2,
    chasePercent: 24.1,
    whiffPercent: 22.0,
    zonePercent: 44.5,
    hardHitPercent: 38.5,
    barrelPercent: 8.1,
    historicalChallengeAttempts: 0,
    historicalChallengeSuccessRate: null,
    fetchedAt: new Date("2026-06-22T08:00:00Z"),
    updatedAt: new Date("2026-06-22T08:00:00Z"),
    ...overrides,
  };
}

export function makeChallengeRecommendation(
  overrides: Partial<ChallengeRecommendation> = {}
): ChallengeRecommendation {
  return {
    id: 1,
    gamePk: 824991,
    atBatIndex: 5,
    balls: 1,
    strikes: 1,
    recommendation: "ALLOW",
    minimumConfidenceRequired: 50,
    expectedValue: 0.06,
    score: 60,
    challengeAvailable: true,
    explanationJson: ["Moderate leverage situation.", "Average plate discipline."],
    createdAt: new Date("2026-06-22T21:05:00Z"),
    triggeredAt: new Date("2026-06-22T21:06:00Z"),
    pitchEventId: 42,
    ...overrides,
  };
}

export function makeLivePitchEvent(
  overrides: Partial<LivePitchEvent> = {}
): LivePitchEvent {
  return {
    id: 42,
    gamePk: 824991,
    playId: "test-play-id-001",
    atBatIndex: 5,
    pitchNumber: 2,
    inning: 7,
    halfInning: "bottom",
    ballsBefore: 1,
    strikesBefore: 1,
    balls: 1,
    strikes: 2,
    outs: 1,
    batterId: 682998,
    pitcherId: 656731,
    callCode: CALL_CODES.CALLED_STRIKE,
    callDescription: "Called Strike",
    hasReview: false,
    isOverturned: null,
    challengerName: null,
    challengerTeamId: null,
    fetchedAt: new Date("2026-06-22T21:06:00Z"),
    rawPayload: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline type fixtures
// ─────────────────────────────────────────────────────────────────────────────

export function makeMlbAtBatSnapshot(
  overrides: Partial<MlbAtBatSnapshot> = {}
): MlbAtBatSnapshot {
  return {
    gamePk: 824991,
    atBatIndex: 5,
    batterId: 682998,
    pitcherId: 656731,
    inning: 7,
    halfInning: "bottom",
    outs: 1,
    runnerOnFirst: false,
    runnerOnSecond: false,
    runnerOnThird: false,
    homeScore: 3,
    awayScore: 3,
    battingTeamId: 133,
    fieldingTeamId: 134,
    fetchedAt: "2026-06-22T21:00:00Z",
    ...overrides,
  };
}

export function makeMlbLivePitchEvent(
  overrides: Partial<MlbLivePitchEvent> = {}
): MlbLivePitchEvent {
  return {
    gamePk: 824991,
    playId: "test-play-id-001",
    atBatIndex: 5,
    pitchNumber: 2,
    inning: 7,
    halfInning: "bottom",
    ballsBefore: 1,
    strikesBefore: 1,
    balls: 1,
    strikes: 2,
    outs: 1,
    batterId: 682998,
    pitcherId: 656731,
    callCode: CALL_CODES.CALLED_STRIKE,
    callDescription: "Called Strike",
    hasReview: false,
    isOverturned: null,
    challengerName: null,
    challengerTeamId: null,
    raw: { isPitch: true },
    fetchedAt: "2026-06-22T21:06:00Z",
    ...overrides,
  };
}

export function makeActiveGame(overrides: Partial<ActiveGame> = {}): ActiveGame {
  return {
    gamePk: 824991,
    officialDate: "2026-06-22",
    scheduledStartTime: "2026-06-22T23:10:00Z",
    status: "Live",
    detailedState: "In Progress",
    homeTeamId: 133,
    homeTeamName: "Oakland Athletics",
    awayTeamId: 134,
    awayTeamName: "Pittsburgh Pirates",
    ...overrides,
  };
}
