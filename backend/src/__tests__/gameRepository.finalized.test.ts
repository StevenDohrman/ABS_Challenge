import { prisma } from "../db/prisma";
import { ensureGameFinalized } from "../db/gameRepository";

jest.mock("../db/prisma", () => ({
  prisma: {
    game: {
      updateMany: jest.fn(),
    },
  },
}));

const mockUpdateMany = prisma.game.updateMany as jest.Mock;

describe("ensureGameFinalized", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("sets status Final on every call", async () => {
    const finalizedAt = new Date("2026-06-17T07:42:00Z");
    await ensureGameFinalized(824991, finalizedAt);

    expect(mockUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { gamePk: 824991 },
      data: expect.objectContaining({ status: "Final" }),
    });
  });

  it("only writes finalizedAt when it is still null", async () => {
    const finalizedAt = new Date("2026-06-17T07:42:00Z");
    await ensureGameFinalized(824991, finalizedAt);

    expect(mockUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { gamePk: 824991, finalizedAt: null },
      data: expect.objectContaining({ finalizedAt }),
    });
  });
});
