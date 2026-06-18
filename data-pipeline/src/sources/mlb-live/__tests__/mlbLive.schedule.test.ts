import {
  fetchGamesForDate,
  fetchLiveGames,
  fetchUpcomingAndLiveGames,
} from "../mlbLive.schedule";
import { fetchSchedule } from "../mlbLive.client";
import {
  buildScheduleResponse,
  buildScheduleGame,
  buildEmptyScheduleResponse,
  GAME_FINAL,
  GAME_IN_PROGRESS,
  GAME_SUSPENDED,
  GAME_PREVIEW,
  LIVE_STATUS,
  FINAL_STATUS,
  PREVIEW_STATUS,
} from "./fixtures/mlbSchedule.fixture";

jest.mock("../mlbLive.client");
const mockFetchSchedule = fetchSchedule as jest.MockedFunction<typeof fetchSchedule>;

// ---------------------------------------------------------------------------
// fetchGamesForDate
// ---------------------------------------------------------------------------

describe("fetchGamesForDate", () => {
  it("returns all games mapped to ActiveGame shape", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_FINAL, GAME_IN_PROGRESS], "2026-06-16")
    );

    const games = await fetchGamesForDate("2026-06-16");

    expect(games).toHaveLength(2);
  });

  it("maps gamePk correctly", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_IN_PROGRESS], "2026-06-16")
    );

    const [game] = await fetchGamesForDate("2026-06-16");

    expect(game.gamePk).toBe(824991);
  });

  it("maps officialDate and scheduledStartTime separately", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_IN_PROGRESS], "2026-06-16")
    );

    const [game] = await fetchGamesForDate("2026-06-16");

    expect(game.officialDate).toBe("2026-06-16");
    expect(game.scheduledStartTime).toBe("2026-06-17T00:40:00Z");
  });

  it("maps team IDs and names correctly", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_IN_PROGRESS], "2026-06-16")
    );

    const [game] = await fetchGamesForDate("2026-06-16");

    expect(game.homeTeamId).toBe(133);
    expect(game.homeTeamName).toBe("Oakland Athletics");
    expect(game.awayTeamId).toBe(134);
    expect(game.awayTeamName).toBe("Pittsburgh Pirates");
  });

  it("maps abstractGameState and detailedState", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_IN_PROGRESS, GAME_FINAL], "2026-06-16")
    );

    const games = await fetchGamesForDate("2026-06-16");
    const live = games.find((g) => g.gamePk === 824991)!;
    const final = games.find((g) => g.gamePk === 823451)!;

    expect(live.status).toBe("Live");
    expect(live.detailedState).toBe("In Progress");
    expect(final.status).toBe("Final");
    expect(final.detailedState).toBe("Final");
  });

  it("returns empty array when the requested date has no entry", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_FINAL], "2026-06-15") // different date
    );

    const games = await fetchGamesForDate("2026-06-16");

    expect(games).toHaveLength(0);
  });

  it("returns empty array when there are no games on the day", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildEmptyScheduleResponse("2026-06-16")
    );

    const games = await fetchGamesForDate("2026-06-16");

    expect(games).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fetchLiveGames
// ---------------------------------------------------------------------------

describe("fetchLiveGames", () => {
  it("returns only games with abstractGameState === Live", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse(
        [GAME_FINAL, GAME_IN_PROGRESS, GAME_SUSPENDED, GAME_PREVIEW],
        "2026-06-16"
      )
    );

    const games = await fetchLiveGames("2026-06-16");

    expect(games.every((g) => g.status === "Live")).toBe(true);
  });

  it("includes suspended games (they are still abstractGameState Live)", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_SUSPENDED], "2026-06-16")
    );

    const games = await fetchLiveGames("2026-06-16");

    expect(games).toHaveLength(1);
    expect(games[0].detailedState).toBe("Suspended");
  });

  it("excludes Final and Preview games", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_FINAL, GAME_PREVIEW], "2026-06-16")
    );

    const games = await fetchLiveGames("2026-06-16");

    expect(games).toHaveLength(0);
  });

  it("returns empty array when no games are live", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildEmptyScheduleResponse("2026-06-16")
    );

    const games = await fetchLiveGames("2026-06-16");

    expect(games).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fetchUpcomingAndLiveGames
// ---------------------------------------------------------------------------

describe("fetchUpcomingAndLiveGames", () => {
  beforeEach(() => {
    // Pin "now" to 2026-06-16T23:00:00Z so relative time window tests are stable
    jest.useFakeTimers({ now: new Date("2026-06-16T23:00:00Z") });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("always includes Live games regardless of time window", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_IN_PROGRESS], "2026-06-16")
    );

    const games = await fetchUpcomingAndLiveGames(0, "2026-06-16");

    expect(games).toHaveLength(1);
    expect(games[0].gamePk).toBe(824991);
  });

  it("includes Preview games starting within the window", async () => {
    // GAME_PREVIEW starts at 2026-06-17T02:10:00Z — 3h10m from "now"
    // Use a wide window so it qualifies
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_PREVIEW], "2026-06-16")
    );

    const games = await fetchUpcomingAndLiveGames(200, "2026-06-16"); // 200-min window

    expect(games).toHaveLength(1);
  });

  it("excludes Preview games starting outside the window", async () => {
    // GAME_PREVIEW starts at 2026-06-17T02:10:00Z — 3h10m from "now"
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_PREVIEW], "2026-06-16")
    );

    const games = await fetchUpcomingAndLiveGames(30, "2026-06-16"); // 30-min window

    expect(games).toHaveLength(0);
  });

  it("always excludes Final games", async () => {
    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse([GAME_FINAL], "2026-06-16")
    );

    const games = await fetchUpcomingAndLiveGames(9999, "2026-06-16");

    expect(games).toHaveLength(0);
  });

  it("combines Live and upcoming Preview games", async () => {
    const soonGame = buildScheduleGame({
      status: PREVIEW_STATUS,
      // Starts 15 minutes from "now" (2026-06-16T23:15:00Z)
      gameDate: "2026-06-16T23:15:00Z",
      officialDate: "2026-06-16",
    });

    mockFetchSchedule.mockResolvedValue(
      buildScheduleResponse(
        [GAME_IN_PROGRESS, GAME_FINAL, soonGame],
        "2026-06-16"
      )
    );

    const games = await fetchUpcomingAndLiveGames(30, "2026-06-16");

    expect(games).toHaveLength(2);
    const pks = games.map((g) => g.gamePk);
    expect(pks).toContain(824991);    // live
    expect(pks).toContain(soonGame.gamePk); // upcoming
    expect(pks).not.toContain(823451); // final
  });
});
