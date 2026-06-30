import { prisma } from "../db/prisma";
import { gameNeedsFinalBackfill } from "../services/finalGameBackfillService";

jest.mock("../db/prisma", () => ({
  prisma: {
    game: {
      findUnique: jest.fn(),
    },
    liveGameSnapshot: {
      count: jest.fn(),
    },
    livePitchEvent: {
      count: jest.fn(),
    },
  },
}));

const mockFindUnique = prisma.game.findUnique as jest.Mock;
const mockSnapshotCount = prisma.liveGameSnapshot.count as jest.Mock;
const mockPitchCount = prisma.livePitchEvent.count as jest.Mock;

describe("gameNeedsFinalBackfill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true when no game row exists", async () => {
    mockFindUnique.mockResolvedValue(null);

    expect(await gameNeedsFinalBackfill(824991, 10, 100)).toBe(true);
  });

  it("returns true when at-bat or pitch counts are short", async () => {
    mockFindUnique.mockResolvedValue({ gamePk: 824991 });
    mockSnapshotCount.mockResolvedValue(8);
    mockPitchCount.mockResolvedValue(90);

    expect(await gameNeedsFinalBackfill(824991, 10, 100)).toBe(true);
  });

  it("returns false when ingest counts match the feed", async () => {
    mockFindUnique.mockResolvedValue({ gamePk: 824991 });
    mockSnapshotCount.mockResolvedValue(10);
    mockPitchCount.mockResolvedValue(100);

    expect(await gameNeedsFinalBackfill(824991, 10, 100)).toBe(false);
  });
});
