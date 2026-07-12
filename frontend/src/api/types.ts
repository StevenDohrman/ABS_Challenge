/**
 * Frontend API types — mirrors backend/src/dto/ by convention.
 * Import from here or from api/dto/* directly.
 */

export type { GameAbstractState, ScheduleGame, ScheduleResponse } from "./dto/schedule";

export type {
  RecommendationLabel,
  PitcherChallengeHints,
  ChallengeRecommendationResponse,
  CountStateRecommendation,
  AtBatRecommendationGridResponse,
  ChallengeOutcome,
  AtBatHistoryItem,
  GameAtBatHistoryResponse,
} from "./dto/recommendation";

export type {
  PostgameAuditItem,
  PostgameAuditResponse,
} from "./dto/postgame";

export type {
  RankingsPeriod,
  PlayerRankingRow,
  TeamRankingRow,
  RankingsLeaderboardSort,
  RankingsSortOrder,
  RankingsBundleResponse,
} from "./dto/rankings";
