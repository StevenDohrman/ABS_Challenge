/**
 * Tests for countPerformanceRepository's bulk write path (Phase 8B).
 */

import {
  bulkUpsertPlayerCountPerformance,
  type PlayerCountPerformanceRow,
} from "../db/countPerformanceRepository";
import { bulkUpsert } from "../db/bulkUpsert";

jest.mock("../db/bulkUpsert");

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;

function makeRow(overrides: Partial<PlayerCountPerformanceRow> = {}): PlayerCountPerformanceRow {
  return {
    playerId: 7001,
    season: 2026,
    buckets: { "0-2": { paCount: 12, woba: 0.28, xwoba: null } },
    fetchedAt: new Date("2026-06-22T08:00:00Z"),
    ...overrides,
  };
}

describe("bulkUpsertPlayerCountPerformance", () => {
  it("does nothing for an empty batch", async () => {
    await bulkUpsertPlayerCountPerformance([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("issues a single bulk statement with a jsonb cast on buckets", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });

    await bulkUpsertPlayerCountPerformance([makeRow()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [rows, options] = mockBulkUpsert.mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(options.table).toBe("player_count_performance");
    expect(options.conflictColumns).toEqual(["playerId", "season"]);
    expect(options.casts).toEqual({ buckets: "jsonb" });
  });

  it("serializes buckets to a JSON string for the raw statement", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    const row = makeRow();

    await bulkUpsertPlayerCountPerformance([row]);

    const [, options] = mockBulkUpsert.mock.calls[0]!;
    const values = options.toRow(row);
    expect(values[2]).toBe(JSON.stringify(row.buckets));
  });
});
