/**
 * Tests for countPerformanceIngestService.ts (Phase 8B).
 *
 * Strategy: mock SavantLineupJob so `playerHistory` fires synchronously for
 * each player, and assert the service collects rollups in memory and issues
 * exactly one bulk write — never a per-player upsert.
 */

import { EventEmitter } from "events";
import { ingestCountPerformanceForGame } from "../services/countPerformanceIngestService";
import { findGameLineups } from "../db/lineupRepository";
import {
  findRecentlyRefreshedPerformancePlayerIds,
  bulkUpsertPlayerCountPerformance,
} from "../db/countPerformanceRepository";
import type { PlayerHistoryResult } from "@abs/data-pipeline";

jest.mock("../db/lineupRepository");
jest.mock("../db/countPerformanceRepository");

class FakeSavantLineupJob extends EventEmitter {
  async run(
    players: Array<{ playerId: number; playerType: "batter" | "pitcher" }>
  ): Promise<void> {
    for (const player of players) {
      const result: PlayerHistoryResult = {
        playerId: player.playerId,
        playerType: player.playerType,
        history: [],
      };
      this.emit("playerHistory", result);
    }
  }
}

jest.mock("@abs/data-pipeline", () => {
  const actual = jest.requireActual("@abs/data-pipeline");
  return {
    ...actual,
    SavantLineupJob: jest.fn().mockImplementation(() => new FakeSavantLineupJob()),
    rollupCountPerformance: jest.fn().mockReturnValue({
      "0-0": { paCount: 5, woba: 0.3, xwoba: null },
    }),
  };
});

const mockFindGameLineups = findGameLineups as jest.MockedFunction<typeof findGameLineups>;
const mockFindRecentlyRefreshed = findRecentlyRefreshedPerformancePlayerIds as jest.MockedFunction<
  typeof findRecentlyRefreshedPerformancePlayerIds
>;
const mockBulkUpsert = bulkUpsertPlayerCountPerformance as jest.MockedFunction<
  typeof bulkUpsertPlayerCountPerformance
>;

function makeLineupRow(playerId: number) {
  return {
    id: playerId,
    gamePk: 824991,
    teamId: 111,
    playerId,
    battingOrder: 1,
    fetchedAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("ingestCountPerformanceForGame", () => {
  beforeEach(() => {
    mockFindRecentlyRefreshed.mockResolvedValue(new Set());
    mockBulkUpsert.mockResolvedValue(undefined);
  });

  it("issues exactly one bulk write for all fetched batters", async () => {
    mockFindGameLineups.mockResolvedValue([
      makeLineupRow(1),
      makeLineupRow(2),
      makeLineupRow(3),
    ] as never);

    await ingestCountPerformanceForGame(824991);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const rows = mockBulkUpsert.mock.calls[0]![0];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.playerId).sort()).toEqual([1, 2, 3]);
  });

  it("skips players refreshed within the last 6 hours", async () => {
    mockFindGameLineups.mockResolvedValue([
      makeLineupRow(1),
      makeLineupRow(2),
    ] as never);
    mockFindRecentlyRefreshed.mockResolvedValue(new Set([1]));

    await ingestCountPerformanceForGame(824991);

    const rows = mockBulkUpsert.mock.calls[0]![0];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.playerId).toBe(2);
  });

  it("does not call the bulk write when there are no batters in the lineup", async () => {
    mockFindGameLineups.mockResolvedValue([]);

    await ingestCountPerformanceForGame(824991);

    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("skips the Savant fetch entirely when everyone was recently refreshed", async () => {
    mockFindGameLineups.mockResolvedValue([makeLineupRow(1)] as never);
    mockFindRecentlyRefreshed.mockResolvedValue(new Set([1]));

    await ingestCountPerformanceForGame(824991);

    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("resolves without throwing when the lineup lookup fails", async () => {
    mockFindGameLineups.mockRejectedValue(new Error("DB unavailable"));

    await expect(ingestCountPerformanceForGame(824991)).resolves.not.toThrow();
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });
});
