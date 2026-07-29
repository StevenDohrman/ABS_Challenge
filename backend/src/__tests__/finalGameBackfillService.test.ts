import { prisma } from "../db/prisma";
import {
  gameNeedsFinalBackfill,
  reconcileFinalIngestGaps,
  shouldSkipFinalBackfillFetch,
} from "../services/finalGameBackfillService";
import { isLiveGameBackfillInProgress } from "../db/pipelineDbQueue";
import {
  fetchLiveFeed,
  buildFinalGameBackfillPayload,
  parsePitchEvents,
  parseGameLineups,
  inferFinalizedAtFromFeed,
} from "@abs/data-pipeline";
import { ensureGameFinalized, markGameIngested, recomputeChallengesRemaining, findGame } from "../db/gameRepository";
import { processGameBackfill } from "../services/gameBackfillService";
import { ingestPitchAndTriggerRecommendation } from "../services/pitchEventPipeline";
import { handleLineupUpdate } from "../services/ingestService";

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

jest.mock("../db/pipelineDbQueue", () => ({
  isLiveGameBackfillInProgress: jest.fn(),
  enqueuePipelineDbWork: jest.fn(async (_label: string, fn: () => Promise<unknown>) => fn()),
  waitForGameIngest: jest.fn(),
}));

jest.mock("@abs/data-pipeline", () => ({
  fetchLiveFeed: jest.fn(),
  buildFinalGameBackfillPayload: jest.fn(),
  parsePitchEvents: jest.fn(),
  parseGameLineups: jest.fn(),
  inferFinalizedAtFromFeed: jest.fn(),
  fetchFinalGamesInRange: jest.fn(),
  resolveGameDataTeamIds: jest.fn(),
}));

jest.mock("../db/gameRepository", () => ({
  ensureGameFinalized: jest.fn(),
  markGameIngested: jest.fn(),
  recomputeChallengesRemaining: jest.fn(),
  findGame: jest.fn(),
}));

jest.mock("../services/gameBackfillService", () => ({
  processGameBackfill: jest.fn((_payload: unknown, onReady?: () => void) => {
    onReady?.();
    return Promise.resolve();
  }),
}));

jest.mock("../services/pitchEventPipeline", () => ({
  ingestPitchAndTriggerRecommendation: jest.fn(),
}));

jest.mock("../services/ingestService", () => ({
  handleGameDiscovered: jest.fn(),
  handleLineupUpdate: jest.fn(),
}));

jest.mock("../services/postgameScheduler", () => ({
  schedulePostgameAudit: jest.fn(),
}));

const mockFindUnique = prisma.game.findUnique as jest.Mock;
const mockSnapshotCount = prisma.liveGameSnapshot.count as jest.Mock;
const mockPitchCount = prisma.livePitchEvent.count as jest.Mock;
const mockIngestInProgress = isLiveGameBackfillInProgress as jest.Mock;

const mockFetchLiveFeed = fetchLiveFeed as jest.Mock;
const mockBuildPayload = buildFinalGameBackfillPayload as jest.Mock;
const mockParsePitchEvents = parsePitchEvents as jest.Mock;
const mockParseGameLineups = parseGameLineups as jest.Mock;
const mockInferFinalizedAt = inferFinalizedAtFromFeed as jest.Mock;
const mockEnsureFinalized = ensureGameFinalized as jest.Mock;
const mockMarkIngested = markGameIngested as jest.Mock;
const mockRecompute = recomputeChallengesRemaining as jest.Mock;
const mockProcessBackfill = processGameBackfill as jest.Mock;
const mockIngestPitch = ingestPitchAndTriggerRecommendation as jest.Mock;
const mockLineupUpdate = handleLineupUpdate as jest.Mock;
const mockFindGame = findGame as jest.Mock;

describe("gameNeedsFinalBackfill", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIngestInProgress.mockReturnValue(false);
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

describe("shouldSkipFinalBackfillFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIngestInProgress.mockReturnValue(false);
  });

  it("returns in_progress when ingest is running", async () => {
    mockIngestInProgress.mockReturnValue(true);
    expect(await shouldSkipFinalBackfillFetch(824991)).toBe("in_progress");
  });

  it("returns ingested only when Final, ingested, and postgame-audited", async () => {
    mockFindGame.mockResolvedValue({
      gamePk: 824991,
      status: "Final",
      ingestedAt: new Date(),
      postgameAuditedAt: new Date(),
    });
    expect(await shouldSkipFinalBackfillFetch(824991)).toBe("ingested");
  });

  it("does not skip Final+ingested games that still need postgame audit", async () => {
    mockFindGame.mockResolvedValue({
      gamePk: 824991,
      status: "Final",
      ingestedAt: new Date(),
      postgameAuditedAt: null,
    });
    expect(await shouldSkipFinalBackfillFetch(824991)).toBeNull();
  });

  it("returns null when game is not yet ingested", async () => {
    mockFindGame.mockResolvedValue({
      gamePk: 824991,
      status: "Final",
      ingestedAt: null,
      postgameAuditedAt: null,
    });
    expect(await shouldSkipFinalBackfillFetch(824991)).toBeNull();
  });
});

describe("reconcileFinalIngestGaps", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInferFinalizedAt.mockReturnValue(new Date("2026-07-28T00:00:00Z"));
    mockParseGameLineups.mockReturnValue([]);
    mockEnsureFinalized.mockResolvedValue(undefined);
    mockMarkIngested.mockResolvedValue(undefined);
    mockRecompute.mockResolvedValue(undefined);
  });

  it("returns false without ingesting when the feed is not Final", async () => {
    mockFetchLiveFeed.mockResolvedValue({
      gameData: { status: { abstractGameState: "Live" } },
    });

    expect(await reconcileFinalIngestGaps(824991)).toBe(false);
    expect(mockProcessBackfill).not.toHaveBeenCalled();
    expect(mockMarkIngested).not.toHaveBeenCalled();
  });

  it("marks ingested and skips backfill when counts already match", async () => {
    mockFetchLiveFeed.mockResolvedValue({
      gameData: { status: { abstractGameState: "Final" } },
    });
    mockBuildPayload.mockReturnValue({
      snapshots: [{ gamePk: 824991, atBatIndex: 0 }, { gamePk: 824991, atBatIndex: 1 }],
      calledStrikeAtBatIndices: [],
    });
    mockParsePitchEvents.mockReturnValue([{ atBatIndex: 0, pitchNumber: 1 }]);
    mockFindUnique.mockResolvedValue({ gamePk: 824991 });
    mockSnapshotCount.mockResolvedValue(2);
    mockPitchCount.mockResolvedValue(1);

    expect(await reconcileFinalIngestGaps(824991)).toBe(false);
    expect(mockProcessBackfill).not.toHaveBeenCalled();
    expect(mockMarkIngested).toHaveBeenCalledWith(824991);
  });

  it("backfills missing at-bats and pitches then marks ingested", async () => {
    mockFetchLiveFeed.mockResolvedValue({
      gameData: { status: { abstractGameState: "Final" } },
    });
    const payload = {
      snapshots: [
        { gamePk: 824991, atBatIndex: 0 },
        { gamePk: 824991, atBatIndex: 1 },
        { gamePk: 824991, atBatIndex: 2 },
      ],
      calledStrikeAtBatIndices: [0],
    };
    const pitches = [
      { atBatIndex: 0, pitchNumber: 1 },
      { atBatIndex: 2, pitchNumber: 1 },
    ];
    mockBuildPayload.mockReturnValue(payload);
    mockParsePitchEvents.mockReturnValue(pitches);
    mockFindUnique.mockResolvedValue({ gamePk: 824991 });
    mockSnapshotCount.mockResolvedValue(1);
    mockPitchCount.mockResolvedValue(1);

    expect(await reconcileFinalIngestGaps(824991)).toBe(true);
    expect(mockProcessBackfill).toHaveBeenCalledWith(payload, expect.any(Function));
    expect(mockIngestPitch).toHaveBeenCalledTimes(2);
    expect(mockRecompute).toHaveBeenCalledWith(824991);
    expect(mockMarkIngested).toHaveBeenCalledWith(824991);
    expect(mockLineupUpdate).not.toHaveBeenCalled();
  });
});
