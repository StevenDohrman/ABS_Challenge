-- Sprint speed (Savant daily ingest)
CREATE TABLE "player_sprint_speed" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "sprintSpeed" DOUBLE PRECISION,
    "homeTo1b" DOUBLE PRECISION,
    "competitiveRuns" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_sprint_speed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_sprint_speed_playerId_season_key" ON "player_sprint_speed"("playerId", "season");
CREATE INDEX "player_sprint_speed_playerId_idx" ON "player_sprint_speed"("playerId");

-- Batting order per game/team (MLB live feed boxscore)
CREATE TABLE "game_lineups" (
    "id" SERIAL NOT NULL,
    "gamePk" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "battingOrder" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_lineups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_lineups_gamePk_teamId_playerId_key" ON "game_lineups"("gamePk", "teamId", "playerId");
CREATE INDEX "game_lineups_gamePk_teamId_idx" ON "game_lineups"("gamePk", "teamId");

ALTER TABLE "game_lineups" ADD CONSTRAINT "game_lineups_gamePk_fkey"
    FOREIGN KEY ("gamePk") REFERENCES "games"("gamePk") ON DELETE CASCADE ON UPDATE CASCADE;

-- Runner identity on bases at at-bat start
ALTER TABLE "live_game_snapshots" ADD COLUMN "runnerFirstId" INTEGER;
ALTER TABLE "live_game_snapshots" ADD COLUMN "runnerSecondId" INTEGER;
ALTER TABLE "live_game_snapshots" ADD COLUMN "runnerThirdId" INTEGER;
