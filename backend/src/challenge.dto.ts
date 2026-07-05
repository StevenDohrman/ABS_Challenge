/**
 * Backend DTOs — the shapes the API returns to the frontend.
 *
 * Thin barrel re-exporting domain-specific DTO modules. Import from here
 * to keep the public API stable for controllers, tests, and frontend mirrors.
 *
 * All data in these DTOs originates from MLB Live API or Baseball Savant.
 * No user input enters the recommendation system.
 */

export {
  type ChallengeRecommendationResponseDto,
  type ChallengeOutcomeDto,
  type AtBatHistoryItemDto,
  type GameAtBatHistoryDto,
  type CountStateRecommendationDto,
  type AtBatRecommendationGridResponseDto,
  toRecommendationDto,
  toGameAtBatHistoryDto,
  toAtBatGridDto,
} from "./dto/recommendation";

export {
  type GameAbstractState,
  type ScheduleGameDto,
  type ScheduleResponseDto,
} from "./dto/schedule";

export {
  type PostgameAuditStatus,
  type PostgameBattingSide,
  type PostgameAuditItemDto,
  type PostgameAuditTeamSummaryDto,
  type PostgameAuditSummaryDto,
  type PostgameAuditResponseDto,
  battingSideFromHalfInning,
  toPostgameAuditItemDto,
  toPostgameAuditResponseDto,
} from "./dto/postgame";

export {
  type RankingsPeriodDto,
  type RankingsLeaderboardSortDto,
  type RankingsSortOrderDto,
  type PlayerRankingRowDto,
  type TeamRankingRowDto,
  type RankingsResponseMetaDto,
  type PlayerRankingsResponseDto,
  type TeamRankingsResponseDto,
  type RankingsBundleResponseDto,
} from "./dto/rankings";
