/**
 * Tests for the Savant daily orchestration serialization (Phase 8A).
 *
 * Before Phase 8A, `SavantDailyJob`'s six `emit(...)` calls fired fully
 * async `job.on(...)` handlers that started their bulk upserts concurrently
 * (EventEmitter.emit does not await listeners). This test uses a fake
 * SavantDailyJob that mimics that same fire-and-forget emit behavior and
 * asserts the ingest handlers below still run one at a time, in the
 * documented order, never overlapping.
 */

import { EventEmitter } from "events";

const callOrder: string[] = [];
let activeHandlers = 0;
let maxConcurrentHandlers = 0;

async function trackedHandler(label: string, delayMs: number): Promise<void> {
  activeHandlers++;
  maxConcurrentHandlers = Math.max(maxConcurrentHandlers, activeHandlers);
  callOrder.push(label);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  activeHandlers--;
}

jest.mock("../services/ingestService", () => ({
  handleBatterStatlines: jest.fn(() => trackedHandler("batterStatlines", 20)),
  handleSprayProfiles: jest.fn(() => trackedHandler("sprayProfiles", 5)),
  handleFielderOaa: jest.fn(() => trackedHandler("fielderOaa", 5)),
  handleSprintSpeed: jest.fn(() => trackedHandler("sprintSpeed", 5)),
  handlePitcherPitchMix: jest.fn(() => trackedHandler("pitcherPitchMix", 5)),
  handleLeagueAverages: jest.fn(() => trackedHandler("leagueAverages", 5)),
  handleGameDiscovered: jest.fn(),
  handleAtBatStart: jest.fn(),
  handleGameOver: jest.fn(),
  handleLineupUpdate: jest.fn(),
  reconcileChallengeCounts: jest.fn(),
}));

class FakeSavantDailyJob extends EventEmitter {
  async run(): Promise<void> {
    // Mirror the real job: emit() fires synchronously and does not await
    // listeners — Promise.allSettled here just resolves once every `run*`
    // helper has *started* (i.e. emitted), matching production behavior.
    await Promise.allSettled([
      Promise.resolve().then(() =>
        this.emit("batterStatlines", [{ playerId: 1 }])
      ),
      Promise.resolve().then(() => this.emit("sprayProfiles", [{ playerId: 2 }])),
      Promise.resolve().then(() => this.emit("fielderOaa", [{ playerId: 3 }])),
      Promise.resolve().then(() => this.emit("sprintSpeed", [{ playerId: 4 }])),
      Promise.resolve().then(() =>
        this.emit("pitcherPitchMix", [{ pitcherId: 5 }])
      ),
      Promise.resolve().then(() =>
        this.emit("leagueAverages", { season: 2026 })
      ),
    ]);
  }
}

jest.mock("@abs/data-pipeline", () => {
  const actual = jest.requireActual("@abs/data-pipeline");
  return {
    ...actual,
    SavantDailyJob: jest.fn().mockImplementation(() => new FakeSavantDailyJob()),
  };
});

import { runSavantDailyJob } from "../orchestrator";
import * as ingestService from "../services/ingestService";

describe("runSavantDailyJob (Phase 8A serialization)", () => {
  beforeEach(() => {
    callOrder.length = 0;
    activeHandlers = 0;
    maxConcurrentHandlers = 0;
    jest.clearAllMocks();
  });

  it("runs every ingest handler exactly once", async () => {
    await runSavantDailyJob();

    expect(ingestService.handleBatterStatlines).toHaveBeenCalledTimes(1);
    expect(ingestService.handleSprayProfiles).toHaveBeenCalledTimes(1);
    expect(ingestService.handleFielderOaa).toHaveBeenCalledTimes(1);
    expect(ingestService.handleSprintSpeed).toHaveBeenCalledTimes(1);
    expect(ingestService.handlePitcherPitchMix).toHaveBeenCalledTimes(1);
    expect(ingestService.handleLeagueAverages).toHaveBeenCalledTimes(1);
  });

  it("never runs more than one ingest handler at a time", async () => {
    await runSavantDailyJob();

    expect(maxConcurrentHandlers).toBe(1);
  });

  it("runs handlers in the documented order: statlines, defense/sprint, pitch mix, league averages", async () => {
    await runSavantDailyJob();

    expect(callOrder).toEqual([
      "batterStatlines",
      "sprayProfiles",
      "fielderOaa",
      "sprintSpeed",
      "pitcherPitchMix",
      "leagueAverages",
    ]);
  });
});
