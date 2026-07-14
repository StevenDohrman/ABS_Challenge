-- Fielding missed RE → catcher attribution + split player missed RE columns

ALTER TABLE "postgame_challenge_audits" ADD COLUMN "catcherId" INTEGER;

ALTER TABLE "player_ranking_day_buckets" ADD COLUMN "battingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_day_buckets" ADD COLUMN "battingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_day_buckets" ADD COLUMN "fieldingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_day_buckets" ADD COLUMN "fieldingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "player_ranking_season_totals" ADD COLUMN "battingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_season_totals" ADD COLUMN "battingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_season_totals" ADD COLUMN "fieldingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_ranking_season_totals" ADD COLUMN "fieldingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
