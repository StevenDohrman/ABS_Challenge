/**
 * Tests for lineupRepository's bulk write path (Phase 8B).
 */

import { upsertGameLineup } from "../db/lineupRepository";
import { bulkUpsert } from "../db/bulkUpsert";
import type { GameLineupEntry } from "@abs/data-pipeline";

jest.mock("../db/bulkUpsert");

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;

function makeEntry(overrides: Partial<GameLineupEntry> = {}): GameLineupEntry {
  return {
    gamePk: 824991,
    teamId: 111,
    playerId: 6001,
    battingOrder: 3,
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  };
}

describe("upsertGameLineup (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertGameLineup([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("issues a single bulk statement for a full lineup (both teams)", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 2, chunks: 1 });

    const entries = [
      makeEntry({ teamId: 111, playerId: 1 }),
      makeEntry({ teamId: 112, playerId: 2 }),
    ];
    await upsertGameLineup(entries);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [rows, options] = mockBulkUpsert.mock.calls[0]!;
    expect(rows).toHaveLength(2);
    expect(options.table).toBe("game_lineups");
    expect(options.conflictColumns).toEqual(["gamePk", "teamId", "playerId"]);
  });

  it("logs but does not throw when the bulk write fails", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("boom"));
    await expect(upsertGameLineup([makeEntry()])).resolves.not.toThrow();
  });
});
