-- Ball rate is unknown when arsenal row has no matching Statcast pitch sample.
ALTER TABLE "pitcher_pitch_mix" ALTER COLUMN "ballRate" DROP NOT NULL;
