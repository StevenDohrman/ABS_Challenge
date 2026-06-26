-- Track whether the batting team could physically challenge for each pre-computed
-- recommendation. The recommendation itself is value-based and independent of
-- challenge availability; this column lets the UI and post-game audit flag
-- "missed opportunities" — high-value calls a team was out of challenges for.
ALTER TABLE "challenge_recommendations"
  ADD COLUMN "challengeAvailable" BOOLEAN NOT NULL DEFAULT true;
