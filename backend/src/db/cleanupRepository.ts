/**
 * Data retention — purge game-related rows older than a configurable number
 * of days. Player stat snapshots are intentionally excluded; they are keyed
 * by player + season and are reused across the whole season.
 *
 * Deletion order respects FK constraints:
 *   challenge_recommendations  (references live_pitch_events + games)
 *   live_game_snapshots        (references games)
 *   live_pitch_events          (references games)
 *   games
 */

import { prisma } from "./prisma";

export async function purgeOldGames(retentionDays: number): Promise<{
  games: number;
  snapshots: number;
  pitchEvents: number;
  recommendations: number;
  savantPitches: number;
  postgameAudits: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffDateStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const oldGames = await prisma.game.findMany({
    where: { gameDate: { lt: cutoffDateStr } },
    select: { gamePk: true },
  });

  if (oldGames.length === 0) {
    return { games: 0, snapshots: 0, pitchEvents: 0, recommendations: 0, savantPitches: 0, postgameAudits: 0 };
  }

  const gamePks = oldGames.map((g) => g.gamePk);

  // Sequential: child tables before games.
  const auditResult   = await prisma.postgameChallengeAudit.deleteMany({ where: { gamePk: { in: gamePks } } });
  const savantResult  = await prisma.savantPitchEvent.deleteMany({ where: { gamePk: { in: gamePks } } });
  const recResult     = await prisma.challengeRecommendation.deleteMany({ where: { gamePk: { in: gamePks } } });
  const snapResult    = await prisma.liveGameSnapshot.deleteMany({ where: { gamePk: { in: gamePks } } });
  const pitchResult   = await prisma.livePitchEvent.deleteMany({ where: { gamePk: { in: gamePks } } });
  const gameResult    = await prisma.game.deleteMany({ where: { gamePk: { in: gamePks } } });

  return {
    games: gameResult.count,
    snapshots: snapResult.count,
    pitchEvents: pitchResult.count,
    recommendations: recResult.count,
    savantPitches: savantResult.count,
    postgameAudits: auditResult.count,
  };
}
