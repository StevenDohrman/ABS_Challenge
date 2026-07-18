const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();

jest.mock("../db/prisma", () => ({
  prisma: {
    playerName: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

const mockFetchPeopleNames = jest.fn();

jest.mock("@abs/data-pipeline", () => ({
  fetchPeopleNames: (...args: unknown[]) => mockFetchPeopleNames(...args),
}));

import {
  extractChallengerPlayerId,
  loadPlayerNamesByIds,
  pickBetterName,
} from "../db/playerNameRepository";

describe("loadPlayerNamesByIds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves registry hits without calling the MLB API", async () => {
    mockFindMany.mockResolvedValue([
      { playerId: 672386, fullName: "Alejandro Kirk" },
    ]);

    const names = await loadPlayerNamesByIds([672386]);

    expect(names.get(672386)).toBe("Alejandro Kirk");
    expect(mockFetchPeopleNames).not.toHaveBeenCalled();
  });

  it("falls back to the MLB people endpoint for ids missing from the registry, and caches the result", async () => {
    mockFindMany.mockResolvedValue([]);
    mockFetchPeopleNames.mockResolvedValue({ 624424: "Some Player" });
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    const names = await loadPlayerNamesByIds([624424]);

    expect(mockFetchPeopleNames).toHaveBeenCalledWith([624424]);
    expect(names.get(624424)).toBe("Some Player");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { playerId: 624424, fullName: "Some Player" },
      })
    );
  });

  it("falls back to the placeholder when the MLB API also has no name", async () => {
    mockFindMany.mockResolvedValue([]);
    mockFetchPeopleNames.mockResolvedValue({});

    const names = await loadPlayerNamesByIds([999999]);

    expect(names.has(999999)).toBe(false);
  });

  it("swallows MLB API failures instead of throwing", async () => {
    mockFindMany.mockResolvedValue([]);
    mockFetchPeopleNames.mockRejectedValue(new Error("network down"));

    await expect(loadPlayerNamesByIds([624424])).resolves.toEqual(new Map());
  });
});

describe("pickBetterName", () => {
  it("prefers a real name over a placeholder", () => {
    expect(pickBetterName(672386, "Player 672386", "Alejandro Kirk")).toBe(
      "Alejandro Kirk"
    );
  });

  it("keeps an existing real name over a placeholder incoming", () => {
    expect(pickBetterName(672386, "Alejandro Kirk", "Player 672386")).toBe(
      "Alejandro Kirk"
    );
  });
});

describe("extractChallengerPlayerId", () => {
  it("reads player id from reviewDetails", () => {
    expect(
      extractChallengerPlayerId({
        reviewDetails: { player: { id: 678882, fullName: "Test Player" } },
      })
    ).toBe(678882);
  });

  it("returns null when reviewDetails missing", () => {
    expect(extractChallengerPlayerId({})).toBeNull();
  });
});
