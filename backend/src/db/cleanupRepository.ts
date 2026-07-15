/**
 * Data retention — purge game-related rows older than a configurable number
 * of days. Season-cumulative rankings data is intentionally excluded from
 * purging (season totals + game-appearance rows), since it's keyed by
 * player/team + season and is meant to accumulate for the whole season
 * regardless of how long the underlying raw game rows are retained. See
 * purgeRankingsForGames for details.
 *
 * Deletion order respects FK constraints:
 *   challenge_recommendations  (references live_pitch_events + games)
 *   live_game_snapshots        (references games)
 *   live_pitch_events          (references games)
 *   games
 */

import { prisma } from "./prisma";
import { purgeRankingsForGames } from "./rankingsBucketRepository";

export async function purgeOldGames(retentionDays: number): Promise<{
  games: number;
  snapshots: number;
  pitchEvents: number;
  recommendations: number;
  postgameAudits: number;
  rankingsContributions: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffDateStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const oldGames = await prisma.game.findMany({
    where: { gameDate: { lt: cutoffDateStr } },
    select: { gamePk: true },
  });

  if (oldGames.length === 0) {
    return {
      games: 0,
      snapshots: 0,
      pitchEvents: 0,
      recommendations: 0,
      postgameAudits: 0,
      rankingsContributions: 0,
    };
  }

  const gamePks = oldGames.map((g) => g.gamePk);

  const rankingsContributions = await purgeRankingsForGames(gamePks);

  // Sequential: child tables before games.
  const auditResult   = await prisma.postgameChallengeAudit.deleteMany({ where: { gamePk: { in: gamePks } } });
  const recResult     = await prisma.challengeRecommendation.deleteMany({ where: { gamePk: { in: gamePks } } });
  const snapResult    = await prisma.liveGameSnapshot.deleteMany({ where: { gamePk: { in: gamePks } } });
  const pitchResult   = await prisma.livePitchEvent.deleteMany({ where: { gamePk: { in: gamePks } } });
  const gameResult    = await prisma.game.deleteMany({ where: { gamePk: { in: gamePks } } });

  return {
    games: gameResult.count,
    snapshots: snapResult.count,
    pitchEvents: pitchResult.count,
    recommendations: recResult.count,
    postgameAudits: auditResult.count,
    rankingsContributions,
  };
}
