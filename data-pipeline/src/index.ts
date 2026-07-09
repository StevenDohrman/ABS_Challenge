/**
 * Public API for the @abs/data-pipeline package.
 *
 * External packages (primarily the backend) should import through this
 * entry point rather than reaching into source subdirectories directly.
 */

// Jobs — the primary integration surface for the backend orchestrator.
export { LivePollJob } from "./jobs/livePollJob";
export { SavantDailyJob } from "./jobs/savantDailyJob";

// Optional jobs — not wired by the backend orchestrator today.
// SavantPostgameJob: Statcast CSV enrichment after a game ends (backend postgame
// audit uses the MLB live feed instead). SavantLineupJob: per-player pitch
// history at lineup confirmation.
export { SavantPostgameJob } from "./jobs/savantPostgameJob";
export { SavantLineupJob } from "./jobs/savantLineupJob";
export type {
  LineupPlayer,
  PlayerHistoryResult,
} from "./jobs/savantLineupJob";

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
  parseGameSnapshot,
  parseGameBench,
  parseGameBullpen,
  parseLiveDefense,
  parsePlayerNamesFromFeed,
  assessBranchRosterFromFeed,
  parseDefenseFromBoxscore,
  resolveTeamDefenses,
  isWarmupOrGameActive,
  extractPitchLocationFromPlayEvent,
} from "./sources/mlb-live/mlbLive.parser";
export {
  resolveGameDataTeam,
  resolveGameDataTeamIds,
} from "./sources/mlb-live/mlbLive.teamRef";
export type {
  BranchRosterAssessment,
  TeamRosterCounts,
} from "./sources/mlb-live/branchRoster";

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
