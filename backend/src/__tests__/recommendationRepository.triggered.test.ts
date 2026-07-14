/**
 * Tests for findGamePksWithTriggeredRecommendations (Phase 8C).
 *
 * Replaces the schedule controller's N per-game `gameHasTriggeredRecommendation`
 * lookups with a single batched query.
 */

import { prisma } from "../db/prisma";
import { findGamePksWithTriggeredRecommendations } from "../db/recommendationRepository";

jest.mock("../db/prisma", () => ({
  prisma: {
    challengeRecommendation: {
      findMany: jest.fn(),
    },
  },
}));

const mockFindMany = prisma.challengeRecommendation.findMany as jest.Mock;

describe("findGamePksWithTriggeredRecommendations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty set without querying when gamePks is empty", async () => {
    const result = await findGamePksWithTriggeredRecommendations([]);

    expect(result).toEqual(new Set());
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("issues exactly one query for many gamePks", async () => {
    mockFindMany.mockResolvedValue([{ gamePk: 1 }, { gamePk: 3 }]);

    const result = await findGamePksWithTriggeredRecommendations([1, 2, 3]);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { gamePk: { in: [1, 2, 3] }, triggeredAt: { not: null } },
      select: { gamePk: true },
      distinct: ["gamePk"],
    });
    expect(result).toEqual(new Set([1, 3]));
  });

  it("returns a set with a single gamePk when only one is triggered", async () => {
    mockFindMany.mockResolvedValue([{ gamePk: 42 }]);

    const result = await findGamePksWithTriggeredRecommendations([42]);

    expect(result).toEqual(new Set([42]));
  });

  it("returns an empty set when no tracked games have triggered", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await findGamePksWithTriggeredRecommendations([1, 2]);

    expect(result).toEqual(new Set());
  });
});
