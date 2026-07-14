/**
 * Tests for pitcherPitchMixRepository's bulk write path (Phase 8A).
 */

import { upsertPitcherPitchMixBatch } from "../db/pitcherPitchMixRepository";
import { bulkUpsert } from "../db/bulkUpsert";
import { recordPlayerNames } from "../db/playerNameRepository";
import type { SavantPitcherPitchMix } from "@abs/data-pipeline";

jest.mock("../db/bulkUpsert");
jest.mock("../db/playerNameRepository", () => ({
  recordPlayerName: jest.fn(),
  recordPlayerNames: jest.fn(),
}));

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;
const mockRecordPlayerNames = recordPlayerNames as jest.MockedFunction<
  typeof recordPlayerNames
>;

function makeRow(overrides: Partial<SavantPitcherPitchMix> = {}): SavantPitcherPitchMix {
  return {
    pitcherId: 5001,
    pitcherName: "Pitcher Player",
    season: 2026,
    pitchType: "FF",
    pitchTypeName: "4-Seam Fastball",
    usageRate: 0.45,
    ballRate: 0.3,
    strikeRate: 0.65,
    pitchCount: 500,
    raw: {},
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  };
}

describe("upsertPitcherPitchMixBatch (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertPitcherPitchMixBatch([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("calls bulkUpsert once with the pitch mix table and 3-column unique key", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    await upsertPitcherPitchMixBatch([makeRow()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [, options] = mockBulkUpsert.mock.calls[0]!;
    expect(options.table).toBe("pitcher_pitch_mix");
    expect(options.conflictColumns).toEqual(["pitcherId", "season", "pitchType"]);
  });

  it("swallows bulk write failures without throwing", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("boom"));
    await expect(upsertPitcherPitchMixBatch([makeRow()])).resolves.not.toThrow();
    expect(mockRecordPlayerNames).not.toHaveBeenCalled();
  });
});
