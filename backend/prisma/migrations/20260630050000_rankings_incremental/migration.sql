-- Precomputed incremental rankings (day buckets + season running totals)

CREATE TABLE "rankings_contributions" (
    "id" SERIAL NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rankings_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rankings_contributions_sourceType_sourceId_key" ON "rankings_contributions"("sourceType", "sourceId");
CREATE INDEX "rankings_contributions_gamePk_idx" ON "rankings_contributions"("gamePk");
CREATE INDEX "rankings_contributions_gameDate_idx" ON "rankings_contributions"("gameDate");

CREATE TABLE "player_ranking_day_buckets" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "challengesUsed" INTEGER NOT NULL DEFAULT 0,
    "challengesOverturned" INTEGER NOT NULL DEFAULT 0,
    "missedOpportunities" INTEGER NOT NULL DEFAULT 0,
    "totalMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fieldingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badChallenges" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_ranking_day_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_ranking_day_buckets_playerId_gameDate_season_key" ON "player_ranking_day_buckets"("playerId", "gameDate", "season");
CREATE INDEX "player_ranking_day_buckets_gameDate_season_idx" ON "player_ranking_day_buckets"("gameDate", "season");

CREATE TABLE "team_ranking_day_buckets" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "challengesUsed" INTEGER NOT NULL DEFAULT 0,
    "challengesOverturned" INTEGER NOT NULL DEFAULT 0,
    "battingMissedCount" INTEGER NOT NULL DEFAULT 0,
    "battingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fieldingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badChallenges" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_ranking_day_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_ranking_day_buckets_teamId_gameDate_season_key" ON "team_ranking_day_buckets"("teamId", "gameDate", "season");
CREATE INDEX "team_ranking_day_buckets_gameDate_season_idx" ON "team_ranking_day_buckets"("gameDate", "season");

CREATE TABLE "player_ranking_season_totals" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "challengesUsed" INTEGER NOT NULL DEFAULT 0,
    "challengesOverturned" INTEGER NOT NULL DEFAULT 0,
    "missedOpportunities" INTEGER NOT NULL DEFAULT 0,
    "totalMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fieldingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badChallenges" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_ranking_season_totals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_ranking_season_totals_playerId_season_key" ON "player_ranking_season_totals"("playerId", "season");

CREATE TABLE "team_ranking_season_totals" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "challengesUsed" INTEGER NOT NULL DEFAULT 0,
    "challengesOverturned" INTEGER NOT NULL DEFAULT 0,
    "battingMissedCount" INTEGER NOT NULL DEFAULT 0,
    "battingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "battingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fieldingGainedRe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badChallenges" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_ranking_season_totals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_ranking_season_totals_teamId_season_key" ON "team_ranking_season_totals"("teamId", "season");

CREATE TABLE "ranking_player_game_appearances" (
    "playerId" INTEGER NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "season" INTEGER NOT NULL,

    CONSTRAINT "ranking_player_game_appearances_pkey" PRIMARY KEY ("playerId","gamePk")
);

CREATE INDEX "ranking_player_game_appearances_playerId_gameDate_season_idx" ON "ranking_player_game_appearances"("playerId", "gameDate", "season");

CREATE TABLE "ranking_team_game_appearances" (
    "teamId" INTEGER NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "season" INTEGER NOT NULL,

    CONSTRAINT "ranking_team_game_appearances_pkey" PRIMARY KEY ("teamId","gamePk")
);

CREATE INDEX "ranking_team_game_appearances_teamId_gameDate_season_idx" ON "ranking_team_game_appearances"("teamId", "gameDate", "season");
