/**
 * Tests for defensiveRepository's bulk write paths (Phase 8A).
 */

import { upsertSprayProfiles, upsertFielderOaa } from "../db/defensiveRepository";
import { bulkUpsert } from "../db/bulkUpsert";
import { recordPlayerNames } from "../db/playerNameRepository";
import type { SavantBatterSprayProfile, SavantFielderOaa } from "@abs/data-pipeline";

jest.mock("../db/bulkUpsert");
jest.mock("../db/playerNameRepository", () => ({
  recordPlayerName: jest.fn(),
  recordPlayerNames: jest.fn(),
}));

const mockBulkUpsert = bulkUpsert as jest.MockedFunction<typeof bulkUpsert>;
const mockRecordPlayerNames = recordPlayerNames as jest.MockedFunction<
  typeof recordPlayerNames
>;

function makeSprayProfile(
  overrides: Partial<SavantBatterSprayProfile> = {}
): SavantBatterSprayProfile {
  return {
    playerId: 2001,
    playerName: "Spray Player",
    season: 2026,
    pa: 250,
    pullPercent: 40,
    straightawayPercent: 35,
    oppoPercent: 25,
    gbPercent: 45,
    fbPercent: 30,
    ldPercent: 25,
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  } as SavantBatterSprayProfile;
}

function makeOaaRow(overrides: Partial<SavantFielderOaa> = {}): SavantFielderOaa {
  return {
    playerId: 3001,
    playerName: "Fielder Player",
    season: 2026,
    position: "SS",
    oaa: 3.5,
    oaaVsRhh: 2.1,
    oaaVsLhh: 1.4,
    raw: {},
    fetchedAt: "2026-06-22T08:00:00Z",
    ...overrides,
  };
}

describe("upsertSprayProfiles (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertSprayProfiles([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("calls bulkUpsert once with the spray table and unique key", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    await upsertSprayProfiles([makeSprayProfile()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [, options] = mockBulkUpsert.mock.calls[0]!;
    expect(options.table).toBe("player_spray_profiles");
    expect(options.conflictColumns).toEqual(["playerId", "season"]);
  });

  it("swallows bulk write failures without throwing", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("boom"));
    await expect(upsertSprayProfiles([makeSprayProfile()])).resolves.not.toThrow();
    expect(mockRecordPlayerNames).not.toHaveBeenCalled();
  });
});

describe("upsertFielderOaa (bulk)", () => {
  it("does nothing for an empty batch", async () => {
    await upsertFielderOaa([]);
    expect(mockBulkUpsert).not.toHaveBeenCalled();
  });

  it("calls bulkUpsert once with the fielder_oaa table and 3-column unique key", async () => {
    mockBulkUpsert.mockResolvedValue({ attempted: 1, chunks: 1 });
    mockRecordPlayerNames.mockResolvedValue(1);

    await upsertFielderOaa([makeOaaRow()]);

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1);
    const [, options] = mockBulkUpsert.mock.calls[0]!;
    expect(options.table).toBe("fielder_oaa");
    expect(options.conflictColumns).toEqual(["playerId", "season", "position"]);
    expect(options.updateColumns).not.toContain("position");
  });

  it("swallows bulk write failures without throwing", async () => {
    mockBulkUpsert.mockRejectedValue(new Error("boom"));
    await expect(upsertFielderOaa([makeOaaRow()])).resolves.not.toThrow();
    expect(mockRecordPlayerNames).not.toHaveBeenCalled();
  });
});
