-- AlterTable
ALTER TABLE "postgame_challenge_audits" ADD COLUMN "challengeSide" TEXT NOT NULL DEFAULT 'batting';
ALTER TABLE "postgame_challenge_audits" ALTER COLUMN "recommendationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "team_ranking_day_buckets" ADD COLUMN "fieldingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team_ranking_day_buckets" ADD COLUMN "fieldingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "team_ranking_season_totals" ADD COLUMN "fieldingMissedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team_ranking_season_totals" ADD COLUMN "fieldingMissedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
