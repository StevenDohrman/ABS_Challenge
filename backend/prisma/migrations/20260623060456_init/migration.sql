-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "gameDate" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "homeChallengesRemaining" INTEGER NOT NULL DEFAULT 3,
    "awayChallengesRemaining" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_game_snapshots" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "inning" INTEGER NOT NULL,
    "halfInning" TEXT NOT NULL,
    "outs" INTEGER NOT NULL,
    "runnerOnFirst" BOOLEAN NOT NULL,
    "runnerOnSecond" BOOLEAN NOT NULL,
    "runnerOnThird" BOOLEAN NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "batterId" INTEGER NOT NULL,
    "pitcherId" INTEGER NOT NULL,
    "battingTeamId" INTEGER NOT NULL,
    "fieldingTeamId" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "live_game_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_pitch_events" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "playId" TEXT,
    "atBatIndex" INTEGER NOT NULL,
    "pitchNumber" INTEGER NOT NULL,
    "inning" INTEGER NOT NULL,
    "halfInning" TEXT NOT NULL,
    "ballsBefore" INTEGER NOT NULL,
    "strikesBefore" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "strikes" INTEGER NOT NULL,
    "outs" INTEGER NOT NULL,
    "batterId" INTEGER NOT NULL,
    "pitcherId" INTEGER NOT NULL,
    "callCode" TEXT,
    "callDescription" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "live_pitch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stat_snapshots" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "battingHand" TEXT,
    "pa" INTEGER NOT NULL,
    "ba" DOUBLE PRECISION,
    "obp" DOUBLE PRECISION,
    "slg" DOUBLE PRECISION,
    "ops" DOUBLE PRECISION,
    "woba" DOUBLE PRECISION,
    "xba" DOUBLE PRECISION,
    "xslg" DOUBLE PRECISION,
    "xwoba" DOUBLE PRECISION,
    "kPercent" DOUBLE PRECISION,
    "bbPercent" DOUBLE PRECISION,
    "chasePercent" DOUBLE PRECISION,
    "whiffPercent" DOUBLE PRECISION,
    "zonePercent" DOUBLE PRECISION,
    "hardHitPercent" DOUBLE PRECISION,
    "barrelPercent" DOUBLE PRECISION,
    "historicalChallengeAttempts" INTEGER NOT NULL DEFAULT 0,
    "historicalChallengeSuccessRate" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_stat_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_recommendations" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "strikes" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "minimumConfidenceRequired" INTEGER NOT NULL,
    "expectedValue" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "explanationJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredAt" TIMESTAMP(3),
    "pitchEventId" INTEGER,

    CONSTRAINT "challenge_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_confidence_inputs" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "atBatIndex" INTEGER NOT NULL,
    "balls" INTEGER NOT NULL,
    "strikes" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_confidence_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_gamePk_key" ON "games"("gamePk");

-- CreateIndex
CREATE INDEX "live_game_snapshots_gamePk_idx" ON "live_game_snapshots"("gamePk");

-- CreateIndex
CREATE UNIQUE INDEX "live_game_snapshots_gamePk_atBatIndex_key" ON "live_game_snapshots"("gamePk", "atBatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "live_pitch_events_playId_key" ON "live_pitch_events"("playId");

-- CreateIndex
CREATE INDEX "live_pitch_events_gamePk_idx" ON "live_pitch_events"("gamePk");

-- CreateIndex
CREATE UNIQUE INDEX "live_pitch_events_gamePk_atBatIndex_pitchNumber_key" ON "live_pitch_events"("gamePk", "atBatIndex", "pitchNumber");

-- CreateIndex
CREATE INDEX "player_stat_snapshots_playerId_idx" ON "player_stat_snapshots"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_stat_snapshots_playerId_season_key" ON "player_stat_snapshots"("playerId", "season");

-- CreateIndex
CREATE INDEX "challenge_recommendations_gamePk_triggeredAt_idx" ON "challenge_recommendations"("gamePk", "triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_recommendations_gamePk_atBatIndex_balls_strikes_key" ON "challenge_recommendations"("gamePk", "atBatIndex", "balls", "strikes");

-- CreateIndex
CREATE INDEX "player_confidence_inputs_gamePk_atBatIndex_idx" ON "player_confidence_inputs"("gamePk", "atBatIndex");

-- AddForeignKey
ALTER TABLE "live_game_snapshots" ADD CONSTRAINT "live_game_snapshots_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_pitch_events" ADD CONSTRAINT "live_pitch_events_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_recommendations" ADD CONSTRAINT "challenge_recommendations_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_recommendations" ADD CONSTRAINT "challenge_recommendations_pitchEventId_fkey" FOREIGN KEY ("pitchEventId") REFERENCES "live_pitch_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_confidence_inputs" ADD CONSTRAINT "player_confidence_inputs_gamePk_fkey" FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE RESTRICT ON UPDATE CASCADE;
