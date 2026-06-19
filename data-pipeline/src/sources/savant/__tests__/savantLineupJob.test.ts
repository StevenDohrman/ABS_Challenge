import { SavantLineupJob, PlayerHistoryResult, LineupPlayer } from "../../../jobs/savantLineupJob";
import { fetchPlayerStatcastHistoryCsv } from "../savant.client";
import {
  PLAYER_STATCAST_HISTORY_CSV,
  EMPTY_PLAYER_HISTORY_CSV,
} from "./fixtures/savant.fixture";

jest.mock("../savant.client");

const mockFetch = fetchPlayerStatcastHistoryCsv as jest.MockedFunction<
  typeof fetchPlayerStatcastHistoryCsv
>;

const SEASON = 2026;
const BATTER: LineupPlayer = { playerId: 682998, playerType: "batter" };
const PITCHER: LineupPlayer = { playerId: 656731, playerType: "pitcher" };

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// playerHistory emission
// ---------------------------------------------------------------------------

describe("playerHistory emission", () => {
  it("emits playerHistory for each player that succeeds", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    const results: PlayerHistoryResult[] = [];
    job.on("playerHistory", (r) => results.push(r));

    await job.run([BATTER, PITCHER], SEASON);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.playerId)).toContain(682998);
    expect(results.map((r) => r.playerId)).toContain(656731);
  });

  it("includes the parsed pitch history in the result", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    const results: PlayerHistoryResult[] = [];
    job.on("playerHistory", (r) => results.push(r));

    await job.run([BATTER], SEASON);

    const result = results[0];
    expect(result.history).toHaveLength(4);
    expect(result.history[0].gamePk).toBe(824991);
  });

  it("emits an empty history when the player has no pitches this season", async () => {
    mockFetch.mockResolvedValue(EMPTY_PLAYER_HISTORY_CSV);

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    const results: PlayerHistoryResult[] = [];
    job.on("playerHistory", (r) => results.push(r));

    await job.run([BATTER], SEASON);

    expect(results[0].history).toHaveLength(0);
  });

  it("passes the correct playerType to each fetch", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    await job.run([BATTER, PITCHER], SEASON);

    const calls = mockFetch.mock.calls;
    const batterCall = calls.find(([id]) => id === 682998)!;
    const pitcherCall = calls.find(([id]) => id === 656731)!;

    expect(batterCall[2]).toBe("batter");
    expect(pitcherCall[2]).toBe("pitcher");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("emits error for a failed player fetch", async () => {
    mockFetch.mockRejectedValue(new Error("Rate limited"));

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    const errors: Error[] = [];
    job.on("error", (e) => errors.push(e));

    await job.run([BATTER], SEASON);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("682998");
    expect(errors[0].message).toContain("Rate limited");
  });

  it("continues fetching remaining players after one fails", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Rate limited")) // batter fails
      .mockResolvedValueOnce(PLAYER_STATCAST_HISTORY_CSV); // pitcher succeeds

    const job = new SavantLineupJob({ batchDelayMs: 0 });
    const results: PlayerHistoryResult[] = [];
    const errors: Error[] = [];
    job.on("playerHistory", (r) => results.push(r));
    job.on("error", (e) => errors.push(e));

    await job.run([BATTER, PITCHER], SEASON);

    expect(errors).toHaveLength(1);
    expect(results).toHaveLength(1);
    expect(results[0].playerId).toBe(656731);
  });
});

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

describe("batching", () => {
  it("issues requests in batches of the configured size", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const players: LineupPlayer[] = [
      { playerId: 1, playerType: "batter" },
      { playerId: 2, playerType: "batter" },
      { playerId: 3, playerType: "batter" },
      { playerId: 4, playerType: "batter" },
      { playerId: 5, playerType: "batter" },
    ];

    const job = new SavantLineupJob({ batchSize: 2, batchDelayMs: 100 });
    const runPromise = job.run(players, SEASON);

    // First batch (players 1 & 2) fires immediately; advance past delay
    await jest.advanceTimersByTimeAsync(100);
    // Second batch (3 & 4) fires; advance past delay
    await jest.advanceTimersByTimeAsync(100);
    // Third batch (5) fires; no delay needed
    await runPromise;

    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("does not insert a delay after the last batch", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const job = new SavantLineupJob({ batchSize: 3, batchDelayMs: 5_000 });

    // 3 players = exactly one batch → should resolve without needing timer advance
    const resolved = await Promise.race([
      job.run([BATTER, PITCHER, { playerId: 999, playerType: "batter" }], SEASON).then(() => "done"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 1_000)),
    ]);

    expect(resolved).toBe("done");
  });

  it("processes all players even when batchDelayMs is 0", async () => {
    mockFetch.mockResolvedValue(PLAYER_STATCAST_HISTORY_CSV);

    const players: LineupPlayer[] = Array.from({ length: 6 }, (_, i) => ({
      playerId: i + 1,
      playerType: "batter" as const,
    }));

    const job = new SavantLineupJob({ batchSize: 3, batchDelayMs: 0 });
    await job.run(players, SEASON);

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("empty input", () => {
  it("resolves immediately with no events for an empty player list", async () => {
    const job = new SavantLineupJob();
    const results: PlayerHistoryResult[] = [];
    job.on("playerHistory", (r) => results.push(r));

    await job.run([], SEASON);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });
});
