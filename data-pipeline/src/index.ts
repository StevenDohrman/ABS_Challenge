/**
 * Public API for the @abs/data-pipeline package.
 *
 * External packages (primarily the backend) should import through this
 * entry point rather than reaching into source subdirectories directly.
 */

// Jobs — the primary integration surface for the backend orchestrator.
export { LivePollJob } from "./jobs/livePollJob";
export { SavantDailyJob } from "./jobs/savantDailyJob";

export { fetchLiveFeed } from "./sources/mlb-live/mlbLive.client";
export {
  fetchGamesForDate,
  fetchFinalGames,
  fetchFinalGamesInRange,
} from "./sources/mlb-live/mlbLive.schedule";
export {
  buildFinalGameBackfillPayload,
  inferFinalizedAtFromFeed,
} from "./sources/mlb-live/mlbLive.backfill";
export {
  parsePitchEvents,
  parseGameLineups,
  extractPitchLocationFromPlayEvent,
} from "./sources/mlb-live/mlbLive.parser";

// MLB live types — emitted by LivePollJob events.
export type {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
  DefensiveLineup,
  BaseRunners,
  GameLineupEntry,
  GameBackfillPayload,
} from "./sources/mlb-live/mlbLive.types";
export { CALLED_STRIKE_CALL_CODE } from "./sources/mlb-live/mlbLive.types";

// Schedule types — used when discovering active games.
export type { ActiveGame } from "./sources/mlb-live/mlbLive.schedule";

// Savant types — emitted by SavantDailyJob events.
export type {
  SavantBatterStatline,
  SavantBatterSprayProfile,
  SavantFielderOaa,
  SavantSprintSpeed,
  SavantPitchRow,
} from "./sources/savant/savant.types";
