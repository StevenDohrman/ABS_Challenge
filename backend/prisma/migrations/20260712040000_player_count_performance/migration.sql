-- AlterTable
ALTER TABLE "league_averages_snapshots" ADD COLUMN "countWobaByState" JSONB;

-- CreateTable
CREATE TABLE "player_count_performance" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "buckets" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_count_performance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_count_performance_playerId_season_key" ON "player_count_performance"("playerId", "season");

-- CreateIndex
CREATE INDEX "player_count_performance_playerId_season_idx" ON "player_count_performance"("playerId", "season");
