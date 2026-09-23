-- Lock the Data API (anon / authenticated) out of public tables.
-- No policies on purpose: those roles see zero rows.
-- Prisma connects as postgres, which bypasses RLS unless FORCE is set.
-- Do not add FORCE ROW LEVEL SECURITY — that would break the app.

ALTER TABLE "games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_game_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_pitch_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_stat_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "postgame_challenge_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_spray_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fielder_oaa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_sprint_speed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "league_averages_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_count_performance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pitcher_pitch_mix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "game_lineups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_names" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rankings_contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_ranking_day_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_ranking_day_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_ranking_season_totals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_ranking_season_totals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ranking_player_game_appearances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ranking_team_game_appearances" ENABLE ROW LEVEL SECURITY;
