-- CreateTable
CREATE TABLE "league_averages_snapshots" (
    "id" SERIAL NOT NULL,
    "season" INTEGER NOT NULL,
    "chaseRate" DOUBLE PRECISION NOT NULL,
    "walkRate" DOUBLE PRECISION NOT NULL,
    "strikeoutRate" DOUBLE PRECISION NOT NULL,
    "whiffRate" DOUBLE PRECISION NOT NULL,
    "ops" DOUBLE PRECISION NOT NULL,
    "woba" DOUBLE PRECISION NOT NULL,
    "gbRate" DOUBLE PRECISION NOT NULL,
    "fbRate" DOUBLE PRECISION NOT NULL,
    "ldRate" DOUBLE PRECISION NOT NULL,
    "pullRate" DOUBLE PRECISION NOT NULL,
    "straightawayRate" DOUBLE PRECISION NOT NULL,
    "oppoRate" DOUBLE PRECISION NOT NULL,
    "sprintSpeed" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_averages_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_averages_snapshots_season_key" ON "league_averages_snapshots"("season");
