const findLastSavantDailyRunAt = jest.fn();

jest.mock("../db/savantDailyFreshness", () => ({
  findLastSavantDailyRunAt: (...args: unknown[]) => findLastSavantDailyRunAt(...args),
}));

jest.mock("../services/ingestService", () => ({
  handleBatterStatlines: jest.fn(),
  handleSprayProfiles: jest.fn(),
  handleFielderOaa: jest.fn(),
  handleSprintSpeed: jest.fn(),
  handlePitcherPitchMix: jest.fn(),
  handleLeagueAverages: jest.fn(),
}));

jest.mock("@abs/data-pipeline", () => {
  const actual = jest.requireActual("@abs/data-pipeline");
  return {
    ...actual,
    SavantDailyJob: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      run: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { bootstrapSavantDailyJob } from "../orchestrator";
import { SavantDailyJob } from "@abs/data-pipeline";

describe("bootstrapSavantDailyJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips the fetch when league averages were persisted less than 24 hours ago", async () => {
    findLastSavantDailyRunAt.mockResolvedValue(new Date(Date.now() - 60 * 60 * 1_000));

    await bootstrapSavantDailyJob();

    expect(SavantDailyJob).not.toHaveBeenCalled();
  });

  it("runs immediately when there is no prior persist", async () => {
    findLastSavantDailyRunAt.mockResolvedValue(null);

    await bootstrapSavantDailyJob();

    expect(SavantDailyJob).toHaveBeenCalledTimes(1);
  });
});
