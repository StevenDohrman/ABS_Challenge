import MockAdapter from "axios-mock-adapter";
import {
  savantHttp,
  fetchExpectedStatsCsv,
  fetchPlateDisciplineCsv,
  fetchSprayProfileCsv,
  fetchFielderOaaCsv,
  fetchSprintSpeedCsv,
  fetchPlayerStatcastHistoryCsv,
  fetchGameStatcastCsv,
  fetchPitchArsenalStatsCsv,
  fetchSeasonPitcherStatcastCsv,
} from "../savant.client";
import {
  EXPECTED_STATS_CSV,
  PLATE_DISCIPLINE_CSV,
  SPRAY_PROFILE_CSV,
  FIELDER_OAA_CSV,
  SPRINT_SPEED_CSV,
  PLAYER_STATCAST_HISTORY_CSV,
  PITCH_ARSENAL_STATS_CSV,
} from "./fixtures/savant.fixture";

const mock = new MockAdapter(savantHttp);

afterEach(() => mock.reset());
afterAll(() => mock.restore());

const BASE = "https://baseballsavant.mlb.com";

// ---------------------------------------------------------------------------
// fetchExpectedStatsCsv
// ---------------------------------------------------------------------------

describe("fetchExpectedStatsCsv", () => {
  it("requests the correct URL", async () => {
    mock.onGet(`${BASE}/leaderboard/expected_statistics`).reply(200, EXPECTED_STATS_CSV);

    await fetchExpectedStatsCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/leaderboard/expected_statistics`);
  });

  it("sends type=batter and year params", async () => {
    mock.onGet(`${BASE}/leaderboard/expected_statistics`).reply(200, EXPECTED_STATS_CSV);

    await fetchExpectedStatsCsv(2026);

    expect(mock.history.get[0].params).toMatchObject({
      type: "batter",
      year: 2026,
      csv: "true",
    });
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/leaderboard/expected_statistics`).reply(200, EXPECTED_STATS_CSV);

    const result = await fetchExpectedStatsCsv(2026);

    expect(result).toBe(EXPECTED_STATS_CSV);
  });

  it("propagates network errors", async () => {
    mock.onGet(`${BASE}/leaderboard/expected_statistics`).networkError();

    await expect(fetchExpectedStatsCsv(2026)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchPlateDisciplineCsv
// ---------------------------------------------------------------------------

describe("fetchPlateDisciplineCsv", () => {
  it("requests the custom leaderboard endpoint", async () => {
    mock.onGet(`${BASE}/leaderboard/custom`).reply(200, PLATE_DISCIPLINE_CSV);

    await fetchPlateDisciplineCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/leaderboard/custom`);
  });

  it("includes the required selections param", async () => {
    mock.onGet(`${BASE}/leaderboard/custom`).reply(200, PLATE_DISCIPLINE_CSV);

    await fetchPlateDisciplineCsv(2026);

    const params: Record<string, string> = mock.history.get[0].params;
    expect(params.selections).toContain("oz_swing_percent");
    expect(params.selections).toContain("whiff_percent");
    expect(params.csv).toBe("true");
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/leaderboard/custom`).reply(200, PLATE_DISCIPLINE_CSV);

    const result = await fetchPlateDisciplineCsv(2026);

    expect(result).toBe(PLATE_DISCIPLINE_CSV);
  });
});

// ---------------------------------------------------------------------------
// fetchSprayProfileCsv
// ---------------------------------------------------------------------------

describe("fetchSprayProfileCsv", () => {
  it("requests the batted-ball endpoint", async () => {
    mock.onGet(`${BASE}/leaderboard/batted-ball`).reply(200, SPRAY_PROFILE_CSV);

    await fetchSprayProfileCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/leaderboard/batted-ball`);
  });

  it("sends the correct year param", async () => {
    mock.onGet(`${BASE}/leaderboard/batted-ball`).reply(200, SPRAY_PROFILE_CSV);

    await fetchSprayProfileCsv(2026);

    expect(mock.history.get[0].params).toMatchObject({ year: 2026, csv: "true" });
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/leaderboard/batted-ball`).reply(200, SPRAY_PROFILE_CSV);

    const result = await fetchSprayProfileCsv(2026);

    expect(result).toBe(SPRAY_PROFILE_CSV);
  });
});

// ---------------------------------------------------------------------------
// fetchFielderOaaCsv
// ---------------------------------------------------------------------------

describe("fetchFielderOaaCsv", () => {
  it("requests the outs_above_average endpoint", async () => {
    mock.onGet(`${BASE}/leaderboard/outs_above_average`).reply(200, FIELDER_OAA_CSV);

    await fetchFielderOaaCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/leaderboard/outs_above_average`);
  });

  it("sends minimal params that return CSV (not the HTML leaderboard page)", async () => {
    mock.onGet(`${BASE}/leaderboard/outs_above_average`).reply(200, FIELDER_OAA_CSV);

    await fetchFielderOaaCsv(2026);

    expect(mock.history.get[0].params).toMatchObject({
      year: 2026,
      type: "Fielder",
      csv: "true",
    });
    expect(mock.history.get[0].params).not.toHaveProperty("pos");
  });

  it("throws when Savant returns HTML instead of CSV", async () => {
    mock
      .onGet(`${BASE}/leaderboard/outs_above_average`)
      .reply(200, "<!DOCTYPE html><html></html>");

    await expect(fetchFielderOaaCsv(2026)).rejects.toThrow(/HTML instead of CSV/);
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/leaderboard/outs_above_average`).reply(200, FIELDER_OAA_CSV);

    const result = await fetchFielderOaaCsv(2026);

    expect(result).toBe(FIELDER_OAA_CSV);
  });

  it("propagates network errors", async () => {
    mock.onGet(`${BASE}/leaderboard/outs_above_average`).networkError();

    await expect(fetchFielderOaaCsv(2026)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchSprintSpeedCsv
// ---------------------------------------------------------------------------

describe("fetchSprintSpeedCsv", () => {
  it("requests the sprint_speed_leaderboard endpoint", async () => {
    mock.onGet(`${BASE}/sprint_speed_leaderboard`).reply(200, SPRINT_SPEED_CSV);

    await fetchSprintSpeedCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/sprint_speed_leaderboard`);
  });

  it("sends year, type=top, and csv params", async () => {
    mock.onGet(`${BASE}/sprint_speed_leaderboard`).reply(200, SPRINT_SPEED_CSV);

    await fetchSprintSpeedCsv(2026);

    expect(mock.history.get[0].params).toMatchObject({
      year: 2026,
      type: "top",
      csv: "true",
    });
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/sprint_speed_leaderboard`).reply(200, SPRINT_SPEED_CSV);

    const result = await fetchSprintSpeedCsv(2026);

    expect(result).toBe(SPRINT_SPEED_CSV);
  });
});

// ---------------------------------------------------------------------------
// fetchPlayerStatcastHistoryCsv
// ---------------------------------------------------------------------------

describe("fetchPlayerStatcastHistoryCsv", () => {
  it("requests the statcast_search/csv endpoint", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    await fetchPlayerStatcastHistoryCsv(682998, 2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/statcast_search/csv`);
  });

  it("sends player_id, season, and player_type=batter by default", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    await fetchPlayerStatcastHistoryCsv(682998, 2026);

    expect(mock.history.get[0].params).toMatchObject({
      player_id: 682998,
      player_type: "batter",
      csv: "true",
    });
    expect(mock.history.get[0].params.hfSea).toContain("2026");
  });

  it("sends player_type=pitcher when specified", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    await fetchPlayerStatcastHistoryCsv(656731, 2026, "pitcher");

    expect(mock.history.get[0].params).toMatchObject({
      player_id: 656731,
      player_type: "pitcher",
    });
  });

  it("returns the raw CSV string", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    const result = await fetchPlayerStatcastHistoryCsv(682998, 2026);

    expect(result).toBe(PLAYER_STATCAST_HISTORY_CSV);
  });

  it("propagates network errors", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).networkError();

    await expect(fetchPlayerStatcastHistoryCsv(682998, 2026)).rejects.toThrow();
  });
});

describe("fetchGameStatcastCsv", () => {
  it("requests statcast_search with game_pk param", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    await fetchGameStatcastCsv(824991);

    expect(mock.history.get[0].params).toMatchObject({
      all: "true",
      type: "details",
      game_pk: 824991,
      csv: "true",
    });
  });

  it("throws when HTML is returned instead of CSV", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, "<!DOCTYPE html><html></html>");

    await expect(fetchGameStatcastCsv(824991)).rejects.toThrow(/HTML instead of CSV/);
  });
});

describe("fetchPitchArsenalStatsCsv", () => {
  it("requests the pitch arsenal stats endpoint", async () => {
    mock
      .onGet(`${BASE}/leaderboard/pitch-arsenal-stats`)
      .reply(200, PITCH_ARSENAL_STATS_CSV);

    await fetchPitchArsenalStatsCsv(2026);

    expect(mock.history.get[0].url).toBe(`${BASE}/leaderboard/pitch-arsenal-stats`);
    expect(mock.history.get[0].params).toMatchObject({
      year: 2026,
      type: "pitcher",
      min: "50",
      csv: "true",
    });
  });

  it("throws when HTML is returned instead of CSV", async () => {
    mock
      .onGet(`${BASE}/leaderboard/pitch-arsenal-stats`)
      .reply(200, "<!DOCTYPE html><html></html>");

    await expect(fetchPitchArsenalStatsCsv(2026)).rejects.toThrow(/HTML instead of CSV/);
  });
});

describe("fetchSeasonPitcherStatcastCsv", () => {
  it("requests season-wide pitcher statcast rows", async () => {
    mock.onGet(`${BASE}/statcast_search/csv`).reply(200, PLAYER_STATCAST_HISTORY_CSV);

    await fetchSeasonPitcherStatcastCsv(2026);

    expect(mock.history.get[0].params).toMatchObject({
      all: "true",
      hfGT: "R|",
      hfSea: "2026|",
      player_type: "pitcher",
      type: "details",
      csv: "true",
    });
  });
});
