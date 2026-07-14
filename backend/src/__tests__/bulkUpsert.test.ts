/**
 * Tests for bulkUpsert.ts (Phase 8A/8B shared helper).
 *
 * Strategy: mock the gated Prisma client's `$executeRaw` and assert on call
 * count (one dbGate slot per statement / chunk) rather than parsing raw SQL.
 */

import { prisma } from "../db/prisma";
import { bulkUpsert } from "../db/bulkUpsert";

jest.mock("../db/prisma", () => ({
  prisma: { $executeRaw: jest.fn() },
}));

const mockExecuteRaw = prisma.$executeRaw as jest.MockedFunction<
  typeof prisma.$executeRaw
>;

interface Row {
  id: number;
  name: string;
}

const baseOptions = {
  table: "some_table",
  columns: ["id", "name"],
  conflictColumns: ["id"],
  updateColumns: ["name"],
  toRow: (r: Row) => [r.id, r.name],
};

describe("bulkUpsert", () => {
  it("no-ops on an empty batch", async () => {
    const result = await bulkUpsert<Row>([], baseOptions);

    expect(result).toEqual({ attempted: 0, chunks: 0 });
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("issues exactly one statement for a batch under the chunk size", async () => {
    mockExecuteRaw.mockResolvedValue(3);
    const rows: Row[] = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ];

    const result = await bulkUpsert(rows, baseOptions);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ attempted: 3, chunks: 1 });
  });

  it("chunks large batches into multiple statements", async () => {
    mockExecuteRaw.mockResolvedValue(1);
    const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      name: `player-${i}`,
    }));

    const result = await bulkUpsert(rows, { ...baseOptions, chunkSize: 2 });

    // 5 rows / chunkSize 2 → 3 statements (2, 2, 1)
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ attempted: 5, chunks: 3 });
  });

  it("propagates a failure from $executeRaw so callers can catch/log it", async () => {
    mockExecuteRaw.mockRejectedValue(new Error("constraint violation"));

    await expect(
      bulkUpsert([{ id: 1, name: "a" }], baseOptions)
    ).rejects.toThrow("constraint violation");
  });

  it("supports an explicit column type cast (e.g. jsonb)", async () => {
    mockExecuteRaw.mockResolvedValue(1);
    interface JsonRow {
      id: number;
      payload: string;
    }

    await bulkUpsert<JsonRow>([{ id: 1, payload: '{"a":1}' }], {
      table: "json_table",
      columns: ["id", "payload"],
      conflictColumns: ["id"],
      updateColumns: ["payload"],
      casts: { payload: "jsonb" },
      toRow: (r) => [r.id, r.payload],
    });

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const sqlArg = mockExecuteRaw.mock.calls[0]?.[0] as { sql: string };
    expect(sqlArg.sql).toContain("::jsonb");
  });
});
