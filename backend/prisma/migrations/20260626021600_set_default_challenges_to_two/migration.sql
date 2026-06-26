-- Lower each team's default challenge allotment from 3 to 2 to match the current
-- ABS rules (2 challenges per team, retained on a successful/overturned call).
--
-- Challenge counts are derived from review pitch events at runtime
-- (recomputeChallengesRemaining), so this column default only applies when a
-- game row is first created without explicit challenge values.
ALTER TABLE "games" ALTER COLUMN "homeChallengesRemaining" SET DEFAULT 2;
ALTER TABLE "games" ALTER COLUMN "awayChallengesRemaining" SET DEFAULT 2;
