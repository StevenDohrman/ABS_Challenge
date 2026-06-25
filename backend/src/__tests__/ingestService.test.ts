/**
 * Tests for ingestService.ts
 *
 * Strategy:
 *   All DB repositories are mocked. Tests verify that:
 *     1. The service delegates to the correct repository function.
 *     2. Errors from repositories are caught and logged — they never propagate
 *        to the caller (so one bad row can't crash the pipeline).
 *     3. handlePitchEvent returns the DB row ID on success and null on failure.
 */

import * as gameRepo from "../db/gameRepository";
import * as playerRepo from "../db/playerRepository";
import {
  handleGameDiscovered,
  handleGameOver,
  handleAtBatStart,
  handlePitchEvent,
  handleBatterStatlines,
} from "../services/ingestService";
import {
  makeActiveGame,
  makeMlbAtBatSnapshot,
  makeMlbLivePitchEvent,
  makeLiveGameSnapshot,
  makeLivePitchEvent,
} from "./fixtures";
import type { SavantBatterStatline } from "@abs/data-pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../db/gameRepository");
jest.mock("../db/playerRepository");

const mockUpsertGame = gameRepo.upsertGame as jest.MockedFunction<
  typeof gameRepo.upsertGame
>;
const mockMarkGameFinal = gameRepo.markGameFinal as jest.MockedFunction<
  typeof gameRepo.markGameFinal
>;
const mockUpsertAtBatSnapshot = gameRepo.upsertAtBatSnapshot as jest.MockedFunction<
  typeof gameRepo.upsertAtBatSnapshot
>;
const mockUpsertPitchEvent = gameRepo.upsertPitchEvent as jest.MockedFunction<
  typeof gameRepo.upsertPitchEvent
>;
const mockUpsertBatterStatlines = playerRepo.upsertBatterStatlines as jest.MockedFunction<
  typeof playerRepo.upsertBatterStatlines
>;

// ─────────────────────────────────────────────────────────────────────────────
// handleGameDiscovered
// ─────────────────────────────────────────────────────────────────────────────

describe("handleGameDiscovered", () => {
  it("calls upsertGame with the discovered game", async () => {
    const game = makeActiveGame({ gamePk: 824991 });
    mockUpsertGame.mockResolvedValue({} as never);

    await handleGameDiscovered(game);

    expect(mockUpsertGame).toHaveBeenCalledWith(game);
  });

  it("resolves without throwing when upsertGame fails", async () => {
    mockUpsertGame.mockRejectedValue(new Error("DB connection lost"));

    await expect(
      handleGameDiscovered(makeActiveGame())
    ).resolves.not.toThrow();
  });

  it("calls upsertGame exactly once per invocation", async () => {
    mockUpsertGame.mockResolvedValue({} as never);

    await handleGameDiscovered(makeActiveGame());

    expect(mockUpsertGame).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleGameOver
// ─────────────────────────────────────────────────────────────────────────────

describe("handleGameOver", () => {
  it("calls markGameFinal with the correct gamePk", async () => {
    mockMarkGameFinal.mockResolvedValue(undefined);

    await handleGameOver(824991);

    expect(mockMarkGameFinal).toHaveBeenCalledWith(824991);
  });

  it("resolves without throwing when markGameFinal fails", async () => {
    mockMarkGameFinal.mockRejectedValue(new Error("Timeout"));

    await expect(handleGameOver(824991)).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleAtBatStart
// ─────────────────────────────────────────────────────────────────────────────

describe("handleAtBatStart", () => {
  it("calls upsertAtBatSnapshot with the incoming snapshot", async () => {
    const snapshot = makeMlbAtBatSnapshot({ atBatIndex: 7 });
    mockUpsertAtBatSnapshot.mockResolvedValue(makeLiveGameSnapshot());

    await handleAtBatStart(snapshot);

    expect(mockUpsertAtBatSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it("resolves without throwing when upsertAtBatSnapshot fails", async () => {
    mockUpsertAtBatSnapshot.mockRejectedValue(new Error("Unique constraint"));

    await expect(
      handleAtBatStart(makeMlbAtBatSnapshot())
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handlePitchEvent
// ─────────────────────────────────────────────────────────────────────────────

describe("handlePitchEvent", () => {
  it("returns the DB row id on success", async () => {
    const storedRow = makeLivePitchEvent({ id: 99 });
    mockUpsertPitchEvent.mockResolvedValue(storedRow);

    const result = await handlePitchEvent(makeMlbLivePitchEvent());

    expect(result).toBe(99);
  });

  it("returns null when upsertPitchEvent throws", async () => {
    mockUpsertPitchEvent.mockRejectedValue(new Error("Write failed"));

    const result = await handlePitchEvent(makeMlbLivePitchEvent());

    expect(result).toBeNull();
  });

  it("resolves (does not throw) when upsertPitchEvent fails", async () => {
    mockUpsertPitchEvent.mockRejectedValue(new Error("Write failed"));

    await expect(
      handlePitchEvent(makeMlbLivePitchEvent())
    ).resolves.not.toThrow();
  });

  it("calls upsertPitchEvent with the incoming event", async () => {
    const event = makeMlbLivePitchEvent({ pitchNumber: 5 });
    mockUpsertPitchEvent.mockResolvedValue(makeLivePitchEvent({ id: 1 }));

    await handlePitchEvent(event);

    expect(mockUpsertPitchEvent).toHaveBeenCalledWith(event);
  });

  it("returns distinct IDs for distinct successful inserts", async () => {
    mockUpsertPitchEvent
      .mockResolvedValueOnce(makeLivePitchEvent({ id: 10 }))
      .mockResolvedValueOnce(makeLivePitchEvent({ id: 11 }));

    const id1 = await handlePitchEvent(makeMlbLivePitchEvent({ pitchNumber: 1 }));
    const id2 = await handlePitchEvent(makeMlbLivePitchEvent({ pitchNumber: 2 }));

    expect(id1).toBe(10);
    expect(id2).toBe(11);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleBatterStatlines
// ─────────────────────────────────────────────────────────────────────────────

describe("handleBatterStatlines", () => {
  const makeStatline = (playerId: number): SavantBatterStatline => ({
    playerId,
    playerName: `Player ${playerId}`,
    season: 2026,
    pa: 300,
    ba: 0.260,
    slg: 0.420,
    woba: 0.330,
    kPercent: 21.0,
    bbPercent: 8.5,
    xba: 0.255,
    xslg: 0.410,
    xwoba: 0.325,
    hardHitPercent: 35.0,
    barrelPercent: 7.5,
    avgExitVelocity: 88.5,
    avgLaunchAngle: 12.0,
    sweetSpotPercent: 30.0,
    chasePercent: 28.0,
    whiffPercent: 23.0,
    zonePercent: 45.0,
    raw: {},
    fetchedAt: "2026-06-22T08:00:00Z",
  });

  it("calls upsertBatterStatlines with the full batch", async () => {
    mockUpsertBatterStatlines.mockResolvedValue(undefined);
    const statlines = [makeStatline(1001), makeStatline(1002)];

    await handleBatterStatlines(statlines);

    expect(mockUpsertBatterStatlines).toHaveBeenCalledWith(statlines);
  });

  it("resolves without throwing when upsertBatterStatlines fails", async () => {
    mockUpsertBatterStatlines.mockRejectedValue(new Error("Bulk write failed"));

    await expect(
      handleBatterStatlines([makeStatline(1001)])
    ).resolves.not.toThrow();
  });

  it("handles an empty statlines array", async () => {
    mockUpsertBatterStatlines.mockResolvedValue(undefined);

    await expect(handleBatterStatlines([])).resolves.not.toThrow();
    expect(mockUpsertBatterStatlines).toHaveBeenCalledWith([]);
  });
});
