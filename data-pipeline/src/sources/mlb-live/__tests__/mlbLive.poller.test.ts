import { GamePoller } from "../mlbLive.poller";
import { fetchLiveFeed, fetchLiveFeedDiff } from "../mlbLive.client";
import {
  buildLiveFeedResponse,
  buildPlay,
  buildPlayEvent,
  buildLinescore,
} from "./fixtures/mlbLiveFeed.fixture";
import { FINAL_STATUS, LIVE_STATUS } from "./fixtures/mlbSchedule.fixture";
import { MlbAtBatSnapshot, MlbLivePitchEvent } from "../mlbLive.types";
import { MlbLiveGameData } from "../mlbLive.api.types";

jest.mock("../mlbLive.client");

const mockFetchLiveFeed = fetchLiveFeed as jest.MockedFunction<typeof fetchLiveFeed>;
const mockFetchLiveFeedDiff = fetchLiveFeedDiff as jest.MockedFunction<typeof fetchLiveFeedDiff>;

const GAME_PK = 824991;

const FINAL_GAME_DATA: MlbLiveGameData = {
  game: { pk: GAME_PK, type: "R", doubleHeader: "N", gameNumber: 1 },
  datetime: { dateTime: "2026-06-17T00:40:00Z", officialDate: "2026-06-16" },
  status: FINAL_STATUS,
  teams: {
    home: { team: { id: 133, name: "Oakland Athletics", abbreviation: "ATH" } },
    away: { team: { id: 134, name: "Pittsburgh Pirates", abbreviation: "PIT" } },
  },
  players: {},
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchLiveFeed.mockReset();
  mockFetchLiveFeedDiff.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// fetch strategy
// ---------------------------------------------------------------------------

describe("fetch strategy", () => {
  it("calls fetchLiveFeed on the first poll", async () => {
    mockFetchLiveFeed.mockResolvedValue(buildLiveFeedResponse());
    const poller = new GamePoller(GAME_PK);

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockFetchLiveFeed).toHaveBeenCalledWith(GAME_PK);
    expect(mockFetchLiveFeedDiff).not.toHaveBeenCalled();

    poller.stop();
  });

  it("calls fetchLiveFeedDiff on subsequent polls using the timestamp from the first response", async () => {
    mockFetchLiveFeed.mockResolvedValue(
      buildLiveFeedResponse({ metaData: { wait: 10, timeStamp: "20260617_043917" } })
    );
    mockFetchLiveFeedDiff.mockResolvedValue(buildLiveFeedResponse());

    const poller = new GamePoller(GAME_PK);
    poller.start();

    await jest.advanceTimersByTimeAsync(0);          // first poll
    await jest.advanceTimersByTimeAsync(30_000);     // second poll (30s active-play interval)

    expect(mockFetchLiveFeedDiff).toHaveBeenCalledWith(GAME_PK, "20260617_043917");

    poller.stop();
  });
});

// ---------------------------------------------------------------------------
// atBatStart emission
// ---------------------------------------------------------------------------

describe("atBatStart", () => {
  it("emits atBatStart when a new at-bat is detected", async () => {
    mockFetchLiveFeed.mockResolvedValue(buildLiveFeedResponse());

    const poller = new GamePoller(GAME_PK);
    const snapshots: MlbAtBatSnapshot[] = [];
    poller.on("atBatStart", (s) => snapshots.push(s));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].atBatIndex).toBe(0);
    expect(snapshots[0].batterId).toBe(682998);

    poller.stop();
  });

  it("does not re-emit atBatStart when the at-bat index has not changed", async () => {
    const feed = buildLiveFeedResponse();
    mockFetchLiveFeed.mockResolvedValue(feed);
    mockFetchLiveFeedDiff.mockResolvedValue(feed);

    const poller = new GamePoller(GAME_PK);
    const snapshots: MlbAtBatSnapshot[] = [];
    poller.on("atBatStart", (s) => snapshots.push(s));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);        // poll 1 → atBatIndex 0
    await jest.advanceTimersByTimeAsync(30_000);   // poll 2 → same atBatIndex

    expect(snapshots).toHaveLength(1);

    poller.stop();
  });

  it("emits atBatStart again when the at-bat index advances", async () => {
    const play0 = buildPlay({
      about: {
        atBatIndex: 0,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: true,
      },
    });
    const play1 = buildPlay({
      about: {
        atBatIndex: 1,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:35:00Z",
        isComplete: false,
      },
    });

    mockFetchLiveFeed.mockResolvedValue(
      buildLiveFeedResponse({
        liveData: {
          plays: { allPlays: [play0], currentPlay: play0 },
          linescore: buildLinescore(),
        },
      })
    );
    mockFetchLiveFeedDiff.mockResolvedValue(
      buildLiveFeedResponse({
        liveData: {
          plays: { allPlays: [play0, play1], currentPlay: play1 },
          linescore: buildLinescore(),
        },
      })
    );

    const poller = new GamePoller(GAME_PK);
    const snapshots: MlbAtBatSnapshot[] = [];
    poller.on("atBatStart", (s) => snapshots.push(s));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);        // poll 1 → atBatIndex 0
    await jest.advanceTimersByTimeAsync(30_000);   // poll 2 → atBatIndex 1

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].atBatIndex).toBe(0);
    expect(snapshots[1].atBatIndex).toBe(1);

    poller.stop();
  });
});

// ---------------------------------------------------------------------------
// pitchEvent emission
// ---------------------------------------------------------------------------

describe("pitchEvent", () => {
  it("emits pitchEvent for new pitch events", async () => {
    mockFetchLiveFeed.mockResolvedValue(buildLiveFeedResponse());

    const poller = new GamePoller(GAME_PK);
    const events: MlbLivePitchEvent[] = [];
    poller.on("pitchEvent", (e) => events.push(e));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(events).toHaveLength(1);
    expect(events[0].callCode).toBe("C");
    expect(events[0].batterId).toBe(682998);

    poller.stop();
  });

  it("deduplicates pitch events that appear in multiple poll responses", async () => {
    const feed = buildLiveFeedResponse();
    mockFetchLiveFeed.mockResolvedValue(feed);
    mockFetchLiveFeedDiff.mockResolvedValue(feed);

    const poller = new GamePoller(GAME_PK);
    const events: MlbLivePitchEvent[] = [];
    poller.on("pitchEvent", (e) => events.push(e));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);        // poll 1 → emits pitch
    await jest.advanceTimersByTimeAsync(30_000);   // poll 2 → same pitch, deduplicated

    expect(events).toHaveLength(1);

    poller.stop();
  });

  it("emits new pitch events when the diff response adds them", async () => {
    const firstPitch = buildPlayEvent({ pitchNumber: 1, playId: "pitch-001" });
    const secondPitch = buildPlayEvent({
      pitchNumber: 2,
      playId: "pitch-002",
      count: { balls: 0, strikes: 2, outs: 2 },
    });

    const play = buildPlay({ playEvents: [firstPitch] });
    const updatedPlay = buildPlay({ playEvents: [firstPitch, secondPitch] });

    mockFetchLiveFeed.mockResolvedValue(
      buildLiveFeedResponse({
        liveData: {
          plays: { allPlays: [play], currentPlay: play },
          linescore: buildLinescore(),
        },
      })
    );
    mockFetchLiveFeedDiff.mockResolvedValue(
      buildLiveFeedResponse({
        liveData: {
          plays: { allPlays: [updatedPlay], currentPlay: updatedPlay },
          linescore: buildLinescore(),
        },
      })
    );

    const poller = new GamePoller(GAME_PK);
    const events: MlbLivePitchEvent[] = [];
    poller.on("pitchEvent", (e) => events.push(e));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);        // poll 1 → pitch-001
    await jest.advanceTimersByTimeAsync(30_000);   // poll 2 → pitch-002 is new

    expect(events).toHaveLength(2);
    expect(events[0].playId).toBe("pitch-001");
    expect(events[1].playId).toBe("pitch-002");

    poller.stop();
  });
});

// ---------------------------------------------------------------------------
// gameOver
// ---------------------------------------------------------------------------

describe("gameOver", () => {
  it("emits gameOver when the game reaches Final", async () => {
    mockFetchLiveFeed.mockResolvedValue(
      buildLiveFeedResponse({ gameData: FINAL_GAME_DATA })
    );

    const poller = new GamePoller(GAME_PK);
    const gameOverPayloads: { gamePk: number }[] = [];
    poller.on("gameOver", (p) => gameOverPayloads.push(p));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(gameOverPayloads).toHaveLength(1);
    expect(gameOverPayloads[0].gamePk).toBe(GAME_PK);
  });

  it("stops polling after emitting gameOver", async () => {
    mockFetchLiveFeed.mockResolvedValue(
      buildLiveFeedResponse({ gameData: FINAL_GAME_DATA })
    );

    const poller = new GamePoller(GAME_PK);
    poller.start();

    await jest.advanceTimersByTimeAsync(0);         // game is Final → stop
    await jest.advanceTimersByTimeAsync(60_000);    // no more polls should fire

    expect(mockFetchLiveFeed).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("emits error on network failure", async () => {
    mockFetchLiveFeed.mockRejectedValue(new Error("Network timeout"));

    const poller = new GamePoller(GAME_PK);
    const errors: Error[] = [];
    poller.on("error", (e) => errors.push(e));

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Network timeout");

    poller.stop();
  });

  it("schedules a retry after an error", async () => {
    mockFetchLiveFeed
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValue(buildLiveFeedResponse());

    const poller = new GamePoller(GAME_PK);
    poller.on("error", () => {}); // suppress unhandled error

    poller.start();
    await jest.advanceTimersByTimeAsync(0);         // poll 1 → error
    await jest.advanceTimersByTimeAsync(10_000);    // retry after 10s

    expect(mockFetchLiveFeed).toHaveBeenCalledTimes(2);

    poller.stop();
  });
});

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

describe("stop", () => {
  it("prevents any polls from running when stop is called before the first poll fires", async () => {
    const poller = new GamePoller(GAME_PK);
    poller.start();
    poller.stop();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(mockFetchLiveFeed).not.toHaveBeenCalled();
  });

  it("is idempotent — calling stop twice does not throw", () => {
    const poller = new GamePoller(GAME_PK);
    poller.start();
    expect(() => {
      poller.stop();
      poller.stop();
    }).not.toThrow();
  });

  it("is safe to call start again after stop", async () => {
    mockFetchLiveFeed.mockResolvedValue(buildLiveFeedResponse());

    const poller = new GamePoller(GAME_PK);
    poller.start();
    poller.stop();

    poller.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockFetchLiveFeed).toHaveBeenCalledTimes(1);

    poller.stop();
  });
});
