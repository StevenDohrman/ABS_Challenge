/**
 * Regression tests for fix/seasonRankings.
 *
 * Bug: purgeRankingsForGames (invoked from the DATA_RETENTION_DAYS cleanup
 * job) reversed contributions against PlayerRankingSeasonTotal /
 * TeamRankingSeasonTotal and deleted RankingPlayerGameAppearance /
 * RankingTeamGameAppearance rows for any purged game. Since "season" mode
 * reads season totals + appearance rows across the whole tracking window
 * (not just the retention window), this silently turned "season" rankings
 * into just another rolling window matching DATA_RETENTION_DAYS.
 */
import { prisma } from "../db/prisma";
import {
  applyRankingsDelta,
  purgeRankingsForGames,
} from "../db/rankingsBucketRepository";

jest.mock("../db/prisma", () => ({
  prisma: {
    playerRankingDayBucket: { upsert: jest.fn() },
    teamRankingDayBucket: { upsert: jest.fn() },
    playerRankingSeasonTotal: { upsert: jest.fn() },
    teamRankingSeasonTotal: { upsert: jest.fn() },
    rankingPlayerGameAppearance: { upsert: jest.fn(), deleteMany: jest.fn() },
    rankingTeamGameAppearance: { upsert: jest.fn(), deleteMany: jest.fn() },
    rankingsContribution: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

const mockPlayerDayUpsert = prisma.playerRankingDayBucket.upsert as jest.Mock;
const mockTeamDayUpsert = prisma.teamRankingDayBucket.upsert as jest.Mock;
const mockPlayerSeasonUpsert = prisma.playerRankingSeasonTotal.upsert as jest.Mock;
const mockTeamSeasonUpsert = prisma.teamRankingSeasonTotal.upsert as jest.Mock;
const mockPlayerAppearanceDeleteMany =
  prisma.rankingPlayerGameAppearance.deleteMany as jest.Mock;
const mockTeamAppearanceDeleteMany =
  prisma.rankingTeamGameAppearance.deleteMany as jest.Mock;
const mockContributionFindMany = prisma.rankingsContribution.findMany as jest.Mock;
const mockContributionDeleteMany = prisma.rankingsContribution.deleteMany as jest.Mock;

const sampleDelta = {
  playerDeltas: [
    {
      playerId: 600,
      challengesUsed: 1,
      challengesOverturned: 1,
      battingGainedRe: 0.2,
    },
  ],
  teamDeltas: [
    {
      teamId: 147,
      challengesUsed: 1,
      challengesOverturned: 1,
      battingGainedRe: 0.2,
    },
  ],
  playerAppearanceIds: [600],
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [
    mockPlayerDayUpsert,
    mockTeamDayUpsert,
    mockPlayerSeasonUpsert,
    mockTeamSeasonUpsert,
  ]) {
    mock.mockResolvedValue({});
  }
});

describe("applyRankingsDelta", () => {
  it("updates both day buckets and season totals by default", async () => {
    await applyRankingsDelta("2026-07-10", 2026, sampleDelta, 823443, 1);

    expect(mockPlayerDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockPlayerSeasonUpsert).toHaveBeenCalledTimes(1);
    expect(mockTeamDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockTeamSeasonUpsert).toHaveBeenCalledTimes(1);
  });

  it("skips season totals when skipSeasonTotals is set", async () => {
    await applyRankingsDelta("2026-07-10", 2026, sampleDelta, 823443, -1, {
      skipSeasonTotals: true,
    });

    expect(mockPlayerDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockTeamDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockPlayerSeasonUpsert).not.toHaveBeenCalled();
    expect(mockTeamSeasonUpsert).not.toHaveBeenCalled();
  });
});

describe("purgeRankingsForGames", () => {
  it("returns 0 and touches nothing when gamePks is empty", async () => {
    const result = await purgeRankingsForGames([]);

    expect(result).toBe(0);
    expect(mockContributionFindMany).not.toHaveBeenCalled();
  });

  it("reverses day buckets but never touches season totals for purged games", async () => {
    mockContributionFindMany.mockResolvedValue([
      {
        gamePk: 823443,
        gameDate: "2026-07-01",
        season: 2026,
        payloadJson: sampleDelta,
      },
    ]);
    mockContributionDeleteMany.mockResolvedValue({ count: 1 });

    const result = await purgeRankingsForGames([823443]);

    expect(result).toBe(1);
    expect(mockPlayerDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockTeamDayUpsert).toHaveBeenCalledTimes(1);
    expect(mockPlayerSeasonUpsert).not.toHaveBeenCalled();
    expect(mockTeamSeasonUpsert).not.toHaveBeenCalled();
  });

  it("deletes the rankings contribution row but preserves game-appearance rows", async () => {
    mockContributionFindMany.mockResolvedValue([
      {
        gamePk: 823443,
        gameDate: "2026-07-01",
        season: 2026,
        payloadJson: sampleDelta,
      },
    ]);
    mockContributionDeleteMany.mockResolvedValue({ count: 1 });

    await purgeRankingsForGames([823443]);

    expect(mockContributionDeleteMany).toHaveBeenCalledWith({
      where: { gamePk: { in: [823443] } },
    });
    // Appearance rows feed "gamesAppeared" for season mode across the whole
    // tracking window, not just the retention window — must not be purged.
    expect(mockPlayerAppearanceDeleteMany).not.toHaveBeenCalled();
    expect(mockTeamAppearanceDeleteMany).not.toHaveBeenCalled();
  });

  it("is a no-op beyond the empty-check when there are no contributions for the games", async () => {
    mockContributionFindMany.mockResolvedValue([]);
    mockContributionDeleteMany.mockResolvedValue({ count: 0 });

    const result = await purgeRankingsForGames([999999]);

    expect(result).toBe(0);
    expect(mockPlayerDayUpsert).not.toHaveBeenCalled();
    expect(mockPlayerSeasonUpsert).not.toHaveBeenCalled();
  });
});
