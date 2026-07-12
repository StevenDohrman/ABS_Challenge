import {
  computeLeagueAveragesFromCsvs,
  fetchLeagueOps,
} from "../leagueAverages";
import {
  EXPECTED_STATS_CSV,
  PLATE_DISCIPLINE_CSV,
} from "./fixtures/savant.fixture";

describe("computeLeagueAveragesFromCsvs", () => {
  it("computes league means from Savant CSVs without extra fetches", () => {
    const snapshot = computeLeagueAveragesFromCsvs(
      PLATE_DISCIPLINE_CSV,
      EXPECTED_STATS_CSV,
      2026,
      0.741,
      "",
      "",
      "2026-07-09T00:00:00.000Z"
    );

    expect(snapshot.season).toBe(2026);
    expect(snapshot.chaseRate).toBeCloseTo((24.5 + 16.2 + 30.0) / 3 / 100, 4);
    expect(snapshot.whiffRate).toBeCloseTo((19.8 + 17.3 + 25.0) / 3 / 100, 4);
    expect(snapshot.walkRate).toBeCloseTo((9.8 + 18.4) / 2 / 100, 4);
    expect(snapshot.strikeoutRate).toBeCloseTo((18.2 + 16.1) / 2 / 100, 4);
    expect(snapshot.ops).toBe(0.741);
    expect(snapshot.woba).toBeCloseTo((0.348 + 0.392 + 0.28) / 3, 4);
    expect(snapshot.gbRate).toBe(0.44);
    expect(snapshot.sprintSpeed).toBe(27);
    expect(snapshot.computedAt).toBe("2026-07-09T00:00:00.000Z");
  });

  it("falls back when CSV columns are missing", () => {
    const snapshot = computeLeagueAveragesFromCsvs("", "", 2026, null);

    expect(snapshot.chaseRate).toBe(0.3);
    expect(snapshot.walkRate).toBe(0.085);
    expect(snapshot.ops).toBe(0.728);
    expect(snapshot.woba).toBe(0.32);
    expect(snapshot.gbRate).toBe(0.44);
    expect(snapshot.pullRate).toBe(0.39);
    expect(snapshot.sprintSpeed).toBe(27);
  });
});

describe("fetchLeagueOps", () => {
  it("returns null on network failure without throwing", async () => {
    await expect(fetchLeagueOps(2099)).resolves.toBeNull();
  });
});
