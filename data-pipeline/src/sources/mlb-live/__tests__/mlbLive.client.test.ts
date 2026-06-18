import MockAdapter from "axios-mock-adapter";
import { mlbHttp, fetchSchedule, fetchLiveFeed, fetchLiveFeedDiff } from "../mlbLive.client";
import {
  buildScheduleResponse,
  GAME_IN_PROGRESS,
  GAME_FINAL,
} from "./fixtures/mlbSchedule.fixture";
import { buildLiveFeedResponse } from "./fixtures/mlbLiveFeed.fixture";

const mock = new MockAdapter(mlbHttp);

afterEach(() => mock.reset());
afterAll(() => mock.restore());

// ---------------------------------------------------------------------------
// fetchSchedule
// ---------------------------------------------------------------------------

describe("fetchSchedule", () => {
  it("requests the correct URL with required params", async () => {
    const fixture = buildScheduleResponse([GAME_FINAL]);
    mock.onGet("https://statsapi.mlb.com/api/v1/schedule").reply(200, fixture);

    await fetchSchedule("2026-06-16");

    const [call] = mock.history.get;
    expect(call.params).toMatchObject({
      sportId: 1,
      date: "2026-06-16",
    });
  });

  it("returns the response data as-is", async () => {
    const fixture = buildScheduleResponse([GAME_FINAL, GAME_IN_PROGRESS]);
    mock.onGet("https://statsapi.mlb.com/api/v1/schedule").reply(200, fixture);

    const result = await fetchSchedule("2026-06-16");

    expect(result.totalGames).toBe(2);
    expect(result.dates[0].games).toHaveLength(2);
  });

  it("uses today's date when none is provided", async () => {
    const fixture = buildScheduleResponse([]);
    mock.onGet("https://statsapi.mlb.com/api/v1/schedule").reply(200, fixture);

    await fetchSchedule();

    const [call] = mock.history.get;
    // Should be a valid ISO date string (YYYY-MM-DD)
    expect(call.params.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("propagates network errors", async () => {
    mock.onGet("https://statsapi.mlb.com/api/v1/schedule").networkError();

    await expect(fetchSchedule("2026-06-16")).rejects.toThrow();
  });

  it("propagates non-200 responses as errors", async () => {
    mock.onGet("https://statsapi.mlb.com/api/v1/schedule").reply(503);

    await expect(fetchSchedule("2026-06-16")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchLiveFeed
// ---------------------------------------------------------------------------

describe("fetchLiveFeed", () => {
  it("requests the correct URL for the given gamePk", async () => {
    const fixture = buildLiveFeedResponse();
    mock
      .onGet("https://statsapi.mlb.com/api/v1.1/game/824991/feed/live")
      .reply(200, fixture);

    await fetchLiveFeed(824991);

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe(
      "https://statsapi.mlb.com/api/v1.1/game/824991/feed/live"
    );
  });

  it("returns the full live feed response", async () => {
    const fixture = buildLiveFeedResponse({ gamePk: 824991 });
    mock
      .onGet("https://statsapi.mlb.com/api/v1.1/game/824991/feed/live")
      .reply(200, fixture);

    const result = await fetchLiveFeed(824991);

    expect(result.gamePk).toBe(824991);
    expect(result.metaData.timeStamp).toBe("20260617_043917");
    expect(result.liveData.linescore.currentInning).toBe(9);
  });

  it("includes current play matchup in response", async () => {
    const fixture = buildLiveFeedResponse();
    mock
      .onGet("https://statsapi.mlb.com/api/v1.1/game/824991/feed/live")
      .reply(200, fixture);

    const result = await fetchLiveFeed(824991);
    const { matchup } = result.liveData.plays.currentPlay;

    expect(matchup.batter.fullName).toBe("Jacob Wilson");
    expect(matchup.pitcher.fullName).toBe("Gregory Soto");
  });

  it("propagates network errors", async () => {
    mock
      .onGet("https://statsapi.mlb.com/api/v1.1/game/824991/feed/live")
      .networkError();

    await expect(fetchLiveFeed(824991)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchLiveFeedDiff
// ---------------------------------------------------------------------------

describe("fetchLiveFeedDiff", () => {
  const DIFF_URL =
    "https://statsapi.mlb.com/api/v1.1/game/824991/feed/live/diffPatch";

  it("requests the diffPatch endpoint", async () => {
    const fixture = buildLiveFeedResponse();
    mock.onGet(DIFF_URL).reply(200, fixture);

    await fetchLiveFeedDiff(824991, "20260617_043917");

    expect(mock.history.get[0].url).toBe(DIFF_URL);
  });

  it("passes startTimecode as a query param", async () => {
    const fixture = buildLiveFeedResponse();
    mock.onGet(DIFF_URL).reply(200, fixture);

    await fetchLiveFeedDiff(824991, "20260617_043917");

    expect(mock.history.get[0].params).toMatchObject({
      startTimecode: "20260617_043917",
    });
  });

  it("returns the diff response", async () => {
    const fixture = buildLiveFeedResponse();
    mock.onGet(DIFF_URL).reply(200, fixture);

    const result = await fetchLiveFeedDiff(824991, "20260617_043917");

    expect(result.gamePk).toBe(824991);
  });
});
