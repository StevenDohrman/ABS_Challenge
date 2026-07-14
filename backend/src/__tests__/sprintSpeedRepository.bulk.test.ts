/**
 * Tests for sprintSpeedRepository's bulk write path (Phase 8A).
 */

import { upsertSprintSpeed } from "../db/sprintSpeedRepository";
import { bulkUpsert } from "../db/bulkUpsert";
import { recordPlayerNames } from "../db/playerNameRepository";
import type { SavantSprintSpeed } from "@abs/data-pipeline";

jest.mock("../db/bulkUpsert");
jest.mock("../db/playerNameRepository", () => ({
  recordPlayerName: jest.fn(),
  recordPlayerNames: jest.fn(),
}));

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;
const mockRecordPlayerNames = recordPlayerNames as jest.MockedFunction<
  typeof recordPlayerNames
>;

function makeRow(overrides: Partial<SavantSprintSpeed> = {}): SavantSprintSpeed {
  return {
    playerId: 4001,
    playerName: "Speedy Player",
    season: 2026,
    position: "CF",
    sprintSpeed: 28.5,
    homeTo1b: 4.1,
    competitiveRuns: 12,
    raw: {},
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  };
}

describe("upsertSprintSpeed (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertSprintSpeed([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("calls bulkUpsert once with the sprint speed table", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    await upsertSprintSpeed([makeRow()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [, options] = mockBulkUpsert.mock.calls[0]!;
    expect(options.table).toBe("player_sprint_speed");
    expect(options.conflictColumns).toEqual(["playerId", "season"]);
  });

  it("swallows bulk write failures without throwing", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("boom"));
    await expect(upsertSprintSpeed([makeRow()])).resolves.not.toThrow();
    expect(mockRecordPlayerNames).not.toHaveBeenCalled();
  });
});
