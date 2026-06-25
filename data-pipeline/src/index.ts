/**
 * Public API for the @abs/data-pipeline package.
 *
 * External packages (primarily the backend) should import through this
 * entry point rather than reaching into source subdirectories directly.
 */

// Jobs — the primary integration surface for the backend orchestrator.
export { LivePollJob } from "./jobs/livePollJob";
export { SavantDailyJob } from "./jobs/savantDailyJob";

// MLB live types — emitted by LivePollJob events.
export type {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
} from "./sources/mlb-live/mlbLive.types";

// Schedule types — used when discovering active games.
export type { ActiveGame } from "./sources/mlb-live/mlbLive.schedule";

// Savant types — emitted by SavantDailyJob events.
export type {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantOutfieldDirectionalOaa,
  SavantSprintSpeed,
} from "./sources/savant/savant.types";
