-- CreateTable
CREATE TABLE "pitcher_pitch_mix" (
    "id" SERIAL NOT NULL,
    "pitcherId" INTEGER NOT NULL,
    "pitcherName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "pitchType" TEXT NOT NULL,
    "pitchTypeName" TEXT NOT NULL,
    "usageRate" DOUBLE PRECISION NOT NULL,
    "ballRate" DOUBLE PRECISION NOT NULL,
    "strikeRate" DOUBLE PRECISION,
    "pitchCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pitcher_pitch_mix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pitcher_pitch_mix_pitcherId_season_idx" ON "pitcher_pitch_mix"("pitcherId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "pitcher_pitch_mix_pitcherId_season_pitchType_key" ON "pitcher_pitch_mix"("pitcherId", "season", "pitchType");
