-- Pitch location on live_pitch_events (MLB feed pitchData)
ALTER TABLE "live_pitch_events" ADD COLUMN "plateX" DOUBLE PRECISION,
ADD COLUMN "plateZ" DOUBLE PRECISION,
ADD COLUMN "strikeZoneTop" DOUBLE PRECISION,
ADD COLUMN "strikeZoneBottom" DOUBLE PRECISION,
ADD COLUMN "mlbZone" INTEGER;

-- Replace Savant enrichment tracking with postgame audit timestamp
ALTER TABLE "games" RENAME COLUMN "savantEnrichedAt" TO "postgameAuditedAt";
ALTER TABLE "games" DROP COLUMN IF EXISTS "savantEnrichmentStartedAt";
ALTER TABLE "games" DROP COLUMN IF EXISTS "savantEnrichmentAttempts";

-- Audit table: MLB-native zone result, drop Savant FK
ALTER TABLE "postgame_challenge_audits" DROP CONSTRAINT IF EXISTS "postgame_challenge_audits_savantPitchEventId_fkey";
ALTER TABLE "postgame_challenge_audits" DROP COLUMN IF EXISTS "savantPitchEventId";
ALTER TABLE "postgame_challenge_audits" RENAME COLUMN "savantZoneResult" TO "zoneResult";
