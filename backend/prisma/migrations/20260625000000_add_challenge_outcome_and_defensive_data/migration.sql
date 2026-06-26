-- Phase 4A: ABS challenge outcome columns on live_pitch_events
ALTER TABLE "live_pitch_events" ADD COLUMN "hasReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "live_pitch_events" ADD COLUMN "isOverturned" BOOLEAN;
ALTER TABLE "live_pitch_events" ADD COLUMN "challengerName" TEXT;
ALTER TABLE "live_pitch_events" ADD COLUMN "challengerTeamId" INTEGER;

-- Phase 4B: Batter spray profiles
CREATE TABLE "player_spray_profiles" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "pa" INTEGER NOT NULL,
    "pullPercent" DOUBLE PRECISION,
    "straightawayPercent" DOUBLE PRECISION,
    "oppoPercent" DOUBLE PRECISION,
    "gbPercent" DOUBLE PRECISION,
    "fbPercent" DOUBLE PRECISION,
    "ldPercent" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spray_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_spray_profiles_playerId_season_key" ON "player_spray_profiles"("playerId", "season");
CREATE INDEX "player_spray_profiles_playerId_idx" ON "player_spray_profiles"("playerId");

-- Phase 4B: Fielder OAA
CREATE TABLE "fielder_oaa" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "oaa" DOUBLE PRECISION,
    "oaaVsRhh" DOUBLE PRECISION,
    "oaaVsLhh" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fielder_oaa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fielder_oaa_playerId_season_position_key" ON "fielder_oaa"("playerId", "season", "position");
CREATE INDEX "fielder_oaa_playerId_idx" ON "fielder_oaa"("playerId");

-- Phase 4B: Outfield directional OAA
CREATE TABLE "outfield_directional_oaa" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "oaa" DOUBLE PRECISION,
    "oaaLeft" DOUBLE PRECISION,
    "oaaStraight" DOUBLE PRECISION,
    "oaaRight" DOUBLE PRECISION,
    "reaction" DOUBLE PRECISION,
    "burst" DOUBLE PRECISION,
    "route" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outfield_directional_oaa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outfield_directional_oaa_playerId_season_key" ON "outfield_directional_oaa"("playerId", "season");
CREATE INDEX "outfield_directional_oaa_playerId_idx" ON "outfield_directional_oaa"("playerId");
