-- AlterTable
ALTER TABLE "games" ADD COLUMN     "savantEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "savantEnrichmentAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "savant_pitch_events" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "atBatNumber" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "pitchNumber" INTEGER NOT NULL,
    "batterId" INTEGER NOT NULL,
    "pitcherId" INTEGER NOT NULL,
    "plateX" DOUBLE PRECISION,
    "plateZ" DOUBLE PRECISION,
    "szTop" DOUBLE PRECISION,
    "szBot" DOUBLE PRECISION,
    "zone" INTEGER,
    "description" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "savant_pitch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postgame_challenge_audits" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "pitchNumber" INTEGER NOT NULL,
    "pitchEventId" INTEGER NOT NULL,
    "recommendationId" INTEGER NOT NULL,
    "savantPitchEventId" INTEGER,
    "inning" INTEGER NOT NULL,
    "halfInning" TEXT NOT NULL,
    "balls" INTEGER NOT NULL,
    "strikes" INTEGER NOT NULL,
    "outs" INTEGER NOT NULL,
    "batterId" INTEGER NOT NULL,
    "pitcherId" INTEGER NOT NULL,
    "originalCall" TEXT NOT NULL,
    "plateX" DOUBLE PRECISION,
    "plateZ" DOUBLE PRECISION,
    "szTop" DOUBLE PRECISION,
    "szBot" DOUBLE PRECISION,
    "savantZoneResult" TEXT NOT NULL,
    "callWasProbablyWrong" BOOLEAN NOT NULL,
    "liveRecommendation" TEXT NOT NULL,
    "playerConfidence" INTEGER,
    "challengeAvailable" BOOLEAN NOT NULL,
    "shouldHaveChallenged" BOOLEAN NOT NULL,
    "missedChallenge" BOOLEAN NOT NULL,
    "badChallengeAllowed" BOOLEAN NOT NULL,
    "runExpectancySwing" DOUBLE PRECISION NOT NULL,
    "notesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postgame_challenge_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savant_pitch_events_gamePk_atBatIndex_pitchNumber_idx" ON "savant_pitch_events"("gamePk", "atBatIndex", "pitchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "savant_pitch_events_gamePk_atBatNumber_pitchNumber_key" ON "savant_pitch_events"("gamePk", "atBatNumber", "pitchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "postgame_challenge_audits_pitchEventId_key" ON "postgame_challenge_audits"("pitchEventId");

-- CreateIndex
CREATE UNIQUE INDEX "postgame_challenge_audits_recommendationId_key" ON "postgame_challenge_audits"("recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "postgame_challenge_audits_savantPitchEventId_key" ON "postgame_challenge_audits"("savantPitchEventId");

-- CreateIndex
CREATE INDEX "postgame_challenge_audits_gamePk_missedChallenge_idx" ON "postgame_challenge_audits"("gamePk", "missedChallenge");

-- CreateIndex
CREATE INDEX "postgame_challenge_audits_gamePk_runExpectancySwing_idx" ON "postgame_challenge_audits"("gamePk", "runExpectancySwing");

-- AddForeignKey
ALTER TABLE "savant_pitch_events" ADD CONSTRAINT "savant_pitch_events_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postgame_challenge_audits" ADD CONSTRAINT "postgame_challenge_audits_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postgame_challenge_audits" ADD CONSTRAINT "postgame_challenge_audits_pitchEventId_fkey" FOREIGN KEY ("pitchEventId") REFERENCES "live_pitch_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postgame_challenge_audits" ADD CONSTRAINT "postgame_challenge_audits_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "challenge_recommendations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postgame_challenge_audits" ADD CONSTRAINT "postgame_challenge_audits_savantPitchEventId_fkey" FOREIGN KEY ("savantPitchEventId") REFERENCES "savant_pitch_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
