/**
 * Tests for playerRepository's bulk write path (Phase 8A).
 *
 * bulkUpsert and playerNameRepository are mocked so we can assert on the
 * shape of the call (table, columns, row mapping) without a real DB.
 */

import { upsertBatterStatlines } from "../db/playerRepository";
import { bulkUpsert } from "../db/bulkUpsert";
import { recordPlayerNames } from "../db/playerNameRepository";
import type { SavantBatterStatline } from "@abs/data-pipeline";

jest.mock("../db/bulkUpsert");
jest.mock("../db/playerNameRepository", () => ({
  recordPlayerName: jest.fn(),
  recordPlayerNames: jest.fn(),
}));

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;
const mockRecordPlayerNames = recordPlayerNames as jest.MockedFunction<
  typeof recordPlayerNames
>;

function makeStatline(overrides: Partial<SavantBatterStatline> = {}): SavantBatterStatline {
  return {
    playerId: 1001,
    playerName: "Test Player",
    season: 2026,
    pa: 300,
    ba: 0.26,
    slg: 0.42,
    woba: 0.33,
    kPercent: 21,
    bbPercent: 8.5,
    xba: 0.255,
    xslg: 0.41,
    xwoba: 0.325,
    hardHitPercent: 35,
    barrelPercent: 7.5,
    avgExitVelocity: 88.5,
    avgLaunchAngle: 12,
    sweetSpotPercent: 30,
    chasePercent: 28,
    whiffPercent: 23,
    zonePercent: 45,
    raw: {},
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  };
}

describe("upsertBatterStatlines (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertBatterStatlines([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("calls bulkUpsert once with the correct table and conflict/update columns", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    await upsertBatterStatlines([makeStatline()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [rows, options] = mockBulkUpsert.mock.calls[0]!;
    expect(rows).toHaveLength(1);
    expect(options.table).toBe("player_stat_snapshots");
    expect(options.conflictColumns).toEqual(["playerId", "season"]);
    // Fields owned by other write paths must never be in the update set.
    expect(options.updateColumns).not.toContain("battingHand");
    expect(options.updateColumns).not.toContain("historicalChallengeAttempts");
    expect(options.updateColumns).not.toContain("historicalChallengeSuccessRate");
  });

  it("records player names after a successful bulk write", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    const statline = makeStatline({ playerId: 555, playerName: "Someone" });
    await upsertBatterStatlines([statline]);

    expect(mockRecordPlayerNames).toHaveBeenCalledWith([
      { playerId: 555, fullName: "Someone" },
    ]);
  });

  it("does not record names when the bulk write fails, but does not throw", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("insert failed"));

    await expect(upsertBatterStatlines([makeStatline()])).resolves.not.toThrow();
    expect(mockRecordPlayerNames).not.toHaveBeenCalled();
  });
});
