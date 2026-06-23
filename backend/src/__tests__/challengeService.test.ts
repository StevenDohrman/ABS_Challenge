/**
 * Tests for challengeService.ts
 *
 * Strategy:
 *   - All DB repositories are mocked so tests run without a real database.
 *   - decideChallenge from @abs/engine is mocked to return a fixed decision so
 *     assertions stay focused on the service's orchestration logic rather than
 *     the engine's scoring logic (which has its own test suite in engine/).
 *   - computeChallengeOutcomeExpectancies runs for real — it is a pure function
 *     with no I/O, and testing it as part of this suite increases confidence that
 *     the service builds correct inputs.
 */

import * as gameRepo from "../db/gameRepository";
import * as playerRepo from "../db/playerRepository";
import * as recRepo from "../db/recommendationRepository";
import * as contextBuilder from "../services/playerContextBuilder";
import {
  precomputeAtBatRecommendations,
  triggerRecommendationIfCalledStrike,
  getLatestRecommendationForGame,
} from "../services/challengeService";
import { ALL_COUNT_STATES, CALL_CODES, SEASONS } from "../db/constants";
import {
  makeGame,
  makeMlbAtBatSnapshot,
  makeMlbLivePitchEvent,
  makePlayerStatSnapshot,
  makeChallengeRecommendation,
  makeLiveGameSnapshot,
} from "./fixtures";
import type { ChallengeDecision } from "@abs/engine";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("@abs/engine", () => ({
  // Let computeChallengeOutcomeExpectancies run for real — it is pure and has
  // no side effects. The real engine tests cover it; here it validates inputs.
  ...jest.requireActual("@abs/engine"),

  // Mock decideChallenge so we can assert on the service's call count and
  // argument shapes without depending on engine scoring thresholds.
  decideChallenge: jest.fn(),
}));

jest.mock("../db/gameRepository");
jest.mock("../db/playerRepository");
jest.mock("../db/recommendationRepository");
jest.mock("../services/playerContextBuilder");

// ─────────────────────────────────────────────────────────────────────────────
// Typed mock references
// ─────────────────────────────────────────────────────────────────────────────

const { decideChallenge } = jest.requireMock("@abs/engine") as {
  decideChallenge: jest.MockedFunction<(input: unknown) => ChallengeDecision>;
};

const mockFindGame = gameRepo.findGame as jest.MockedFunction<typeof gameRepo.findGame>;
const mockFindLatestAtBatSnapshot = gameRepo.findLatestAtBatSnapshot as jest.MockedFunction<
  typeof gameRepo.findLatestAtBatSnapshot
>;
const mockFindPlayerStatSnapshot = playerRepo.findPlayerStatSnapshot as jest.MockedFunction<
  typeof playerRepo.findPlayerStatSnapshot
>;
const mockUpsertRecommendation = recRepo.upsertRecommendation as jest.MockedFunction<
  typeof recRepo.upsertRecommendation
>;
const mockMarkRecommendationTriggered =
  recRepo.markRecommendationTriggered as jest.MockedFunction<
    typeof recRepo.markRecommendationTriggered
  >;
const mockFindLatestTriggeredRecommendation =
  recRepo.findLatestTriggeredRecommendation as jest.MockedFunction<
    typeof recRepo.findLatestTriggeredRecommendation
  >;
const mockFindRecommendation = recRepo.findRecommendation as jest.MockedFunction<
  typeof recRepo.findRecommendation
>;
const mockBuildPlayerChallengeContext =
  contextBuilder.buildPlayerChallengeContext as jest.MockedFunction<
    typeof contextBuilder.buildPlayerChallengeContext
  >;
const mockBuildDefaultPlayerChallengeContext =
  contextBuilder.buildDefaultPlayerChallengeContext as jest.MockedFunction<
    typeof contextBuilder.buildDefaultPlayerChallengeContext
  >;

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture decision
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_DECISION: ChallengeDecision = {
  recommendation: "ALLOW",
  score: 60,
  expectedValueOfChallenge: 0.06,
  minimumPlayerConfidenceRequired: 50,
  explanation: ["Test explanation."],
};

const DEFAULT_PLAYER_CONTEXT = {
  playerId: 682998,
  battingHand: null as null,
  obp: null,
  ops: null,
  walkRate: null,
  strikeoutRate: null,
  chasePercent: null,
  whiffPercent: null,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// precomputeAtBatRecommendations
// ─────────────────────────────────────────────────────────────────────────────

describe("precomputeAtBatRecommendations", () => {
  beforeEach(() => {
    decideChallenge.mockReturnValue(FIXED_DECISION);
    mockUpsertRecommendation.mockResolvedValue(makeChallengeRecommendation());
    mockBuildDefaultPlayerChallengeContext.mockReturnValue(DEFAULT_PLAYER_CONTEXT);
    mockBuildPlayerChallengeContext.mockReturnValue(DEFAULT_PLAYER_CONTEXT);
  });

  describe("when the game is not in the database", () => {
    it("does not write any recommendations and returns without throwing", async () => {
      mockFindGame.mockResolvedValue(null);

      await expect(
        precomputeAtBatRecommendations(makeMlbAtBatSnapshot())
      ).resolves.not.toThrow();

      expect(mockUpsertRecommendation).not.toHaveBeenCalled();
    });
  });

  describe("when the game exists", () => {
    beforeEach(() => {
      mockFindGame.mockResolvedValue(makeGame());
      mockFindPlayerStatSnapshot.mockResolvedValue(null); // no Savant data yet
    });

    it("calls upsertRecommendation exactly 12 times — once per count state", async () => {
      await precomputeAtBatRecommendations(makeMlbAtBatSnapshot());

      expect(mockUpsertRecommendation).toHaveBeenCalledTimes(
        ALL_COUNT_STATES.length
      );
    });

    it("passes the correct gamePk to every upsertRecommendation call", async () => {
      const snapshot = makeMlbAtBatSnapshot({ gamePk: 99001 });
      mockFindGame.mockResolvedValue(makeGame({ gamePk: 99001 }));

      await precomputeAtBatRecommendations(snapshot);

      for (const call of mockUpsertRecommendation.mock.calls) {
        expect(call[0].gamePk).toBe(99001);
      }
    });

    it("passes the correct atBatIndex to every upsertRecommendation call", async () => {
      const snapshot = makeMlbAtBatSnapshot({ atBatIndex: 12 });

      await precomputeAtBatRecommendations(snapshot);

      for (const call of mockUpsertRecommendation.mock.calls) {
        expect(call[0].atBatIndex).toBe(12);
      }
    });

    it("covers every count state in ALL_COUNT_STATES exactly once", async () => {
      await precomputeAtBatRecommendations(makeMlbAtBatSnapshot());

      const writtenCountKeys = mockUpsertRecommendation.mock.calls.map(
        ([input]) => `${input.balls}-${input.strikes}`
      );
      const expectedKeys = ALL_COUNT_STATES.map(([b, s]) => `${b}-${s}`);

      expect(writtenCountKeys.sort()).toEqual(expectedKeys.sort());
    });

    it("uses the home team's challenges when the batting team is home (bottom half)", async () => {
      const snapshot = makeMlbAtBatSnapshot({ halfInning: "bottom" });
      const game = makeGame({ homeChallengesRemaining: 2, awayChallengesRemaining: 3 });
      mockFindGame.mockResolvedValue(game);

      await precomputeAtBatRecommendations(snapshot);

      // Every decideChallenge call should have received 2 (home challenges)
      for (const call of decideChallenge.mock.calls) {
        const input = call[0] as { gameState: { challengesRemaining: number } };
        expect(input.gameState.challengesRemaining).toBe(2);
      }
    });

    it("uses the away team's challenges when the batting team is away (top half)", async () => {
      const snapshot = makeMlbAtBatSnapshot({ halfInning: "top" });
      const game = makeGame({ homeChallengesRemaining: 3, awayChallengesRemaining: 1 });
      mockFindGame.mockResolvedValue(game);

      await precomputeAtBatRecommendations(snapshot);

      for (const call of decideChallenge.mock.calls) {
        const input = call[0] as { gameState: { challengesRemaining: number } };
        expect(input.gameState.challengesRemaining).toBe(1);
      }
    });

    it("uses the default player context when no Savant snapshot exists for the batter", async () => {
      mockFindPlayerStatSnapshot.mockResolvedValue(null);

      await precomputeAtBatRecommendations(makeMlbAtBatSnapshot());

      expect(mockBuildDefaultPlayerChallengeContext).toHaveBeenCalledWith(
        expect.any(Number)
      );
      expect(mockBuildPlayerChallengeContext).not.toHaveBeenCalled();
    });

    it("uses the stored player context when a Savant snapshot exists", async () => {
      mockFindPlayerStatSnapshot.mockResolvedValue(makePlayerStatSnapshot());

      await precomputeAtBatRecommendations(makeMlbAtBatSnapshot());

      expect(mockBuildPlayerChallengeContext).toHaveBeenCalledTimes(1);
      expect(mockBuildDefaultPlayerChallengeContext).not.toHaveBeenCalled();
    });

    it("looks up the stat snapshot using the current season constant", async () => {
      const snapshot = makeMlbAtBatSnapshot({ batterId: 682998 });

      await precomputeAtBatRecommendations(snapshot);

      expect(mockFindPlayerStatSnapshot).toHaveBeenCalledWith(
        682998,
        SEASONS.CURRENT
      );
    });

    it("computes a positive run differential for the home team in the bottom half", async () => {
      const snapshot = makeMlbAtBatSnapshot({
        halfInning: "bottom",
        homeScore: 4,
        awayScore: 2,
      });

      await precomputeAtBatRecommendations(snapshot);

      for (const call of decideChallenge.mock.calls) {
        const input = call[0] as {
          gameState: { runDifferentialForBattingTeam: number };
        };
        // Home team (batting) leads by 2 → +2
        expect(input.gameState.runDifferentialForBattingTeam).toBe(2);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// triggerRecommendationIfCalledStrike
// ─────────────────────────────────────────────────────────────────────────────

describe("triggerRecommendationIfCalledStrike", () => {
  const DB_ROW_ID = 42;

  beforeEach(() => {
    mockMarkRecommendationTriggered.mockResolvedValue(undefined);
  });

  it("does nothing for a ball (non-called-strike)", async () => {
    const ballEvent = makeMlbLivePitchEvent({ callCode: CALL_CODES.BALL });

    await triggerRecommendationIfCalledStrike(ballEvent, DB_ROW_ID);

    expect(mockFindRecommendation).not.toHaveBeenCalled();
    expect(mockMarkRecommendationTriggered).not.toHaveBeenCalled();
  });

  it("does nothing for a swinging strike (non-called-strike)", async () => {
    const swingEvent = makeMlbLivePitchEvent({ callCode: "S" });

    await triggerRecommendationIfCalledStrike(swingEvent, DB_ROW_ID);

    expect(mockMarkRecommendationTriggered).not.toHaveBeenCalled();
  });

  it("does nothing when callCode is undefined", async () => {
    const event = makeMlbLivePitchEvent({ callCode: undefined });

    await triggerRecommendationIfCalledStrike(event, DB_ROW_ID);

    expect(mockMarkRecommendationTriggered).not.toHaveBeenCalled();
  });

  describe("for a called strike", () => {
    const calledStrikeEvent = makeMlbLivePitchEvent({
      callCode: CALL_CODES.CALLED_STRIKE,
      gamePk: 824991,
      atBatIndex: 5,
      ballsBefore: 1,
      strikesBefore: 1,
    });

    it("looks up the pre-computed recommendation using the count BEFORE the pitch", async () => {
      mockFindRecommendation.mockResolvedValue(makeChallengeRecommendation());

      await triggerRecommendationIfCalledStrike(calledStrikeEvent, DB_ROW_ID);

      expect(mockFindRecommendation).toHaveBeenCalledWith(
        824991, // gamePk
        5,      // atBatIndex
        1,      // ballsBefore
        1       // strikesBefore
      );
    });

    it("marks the recommendation as triggered when one is found", async () => {
      mockFindRecommendation.mockResolvedValue(makeChallengeRecommendation());

      await triggerRecommendationIfCalledStrike(calledStrikeEvent, DB_ROW_ID);

      expect(mockMarkRecommendationTriggered).toHaveBeenCalledWith(
        824991, 5, 1, 1, DB_ROW_ID
      );
    });

    it("does not call markRecommendationTriggered when no pre-computed row is found", async () => {
      mockFindRecommendation.mockResolvedValue(null);

      await triggerRecommendationIfCalledStrike(calledStrikeEvent, DB_ROW_ID);

      expect(mockMarkRecommendationTriggered).not.toHaveBeenCalled();
    });

    it("resolves without throwing when no pre-computed recommendation is found", async () => {
      mockFindRecommendation.mockResolvedValue(null);

      await expect(
        triggerRecommendationIfCalledStrike(calledStrikeEvent, DB_ROW_ID)
      ).resolves.not.toThrow();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getLatestRecommendationForGame
// ─────────────────────────────────────────────────────────────────────────────

describe("getLatestRecommendationForGame", () => {
  it("returns null when no triggered recommendation exists", async () => {
    mockFindLatestTriggeredRecommendation.mockResolvedValue(null);

    const result = await getLatestRecommendationForGame(824991);

    expect(result).toBeNull();
  });

  it("returns null when a recommendation exists but no snapshot does", async () => {
    mockFindLatestTriggeredRecommendation.mockResolvedValue(
      makeChallengeRecommendation()
    );
    mockFindLatestAtBatSnapshot.mockResolvedValue(null);

    const result = await getLatestRecommendationForGame(824991);

    expect(result).toBeNull();
  });

  it("returns { recommendation, snapshot } when both exist", async () => {
    const rec = makeChallengeRecommendation();
    const snapshot = makeLiveGameSnapshot();
    mockFindLatestTriggeredRecommendation.mockResolvedValue(rec);
    mockFindLatestAtBatSnapshot.mockResolvedValue(snapshot);

    const result = await getLatestRecommendationForGame(824991);

    expect(result).not.toBeNull();
    expect(result!.recommendation).toBe(rec);
    expect(result!.snapshot).toBe(snapshot);
  });

  it("queries by the supplied gamePk", async () => {
    mockFindLatestTriggeredRecommendation.mockResolvedValue(null);

    await getLatestRecommendationForGame(99999);

    expect(mockFindLatestTriggeredRecommendation).toHaveBeenCalledWith(99999);
  });
});
