import { prisma } from "./prisma";
import type { PlayerBucketDelta, TeamBucketDelta } from "../services/rankingsDelta";

async function applyPlayerDayBucket(
  playerId: number,
  gameDate: string,
  season: number,
  delta: PlayerBucketDelta,
  sign: 1 | -1
): Promise<void> {
  const mult = sign;
  await prisma.playerRankingDayBucket.upsert({
    where: {
      playerId_gameDate_season: { playerId, gameDate, season },
    },
    create: {
      playerId,
      gameDate,
      season,
      challengesUsed: (delta.challengesUsed ?? 0) * mult,
      challengesOverturned: (delta.challengesOverturned ?? 0) * mult,
      missedOpportunities: (delta.missedOpportunities ?? 0) * mult,
      totalMissedValue: (delta.totalMissedValue ?? 0) * mult,
      battingMissedCount: (delta.battingMissedCount ?? 0) * mult,
      battingMissedValue: (delta.battingMissedValue ?? 0) * mult,
      fieldingMissedCount: (delta.fieldingMissedCount ?? 0) * mult,
      fieldingMissedValue: (delta.fieldingMissedValue ?? 0) * mult,
      battingGainedRe: (delta.battingGainedRe ?? 0) * mult,
      fieldingGainedRe: (delta.fieldingGainedRe ?? 0) * mult,
      badChallenges: (delta.badChallenges ?? 0) * mult,
    },
    update: {
      challengesUsed: { increment: (delta.challengesUsed ?? 0) * mult },
      challengesOverturned: { increment: (delta.challengesOverturned ?? 0) * mult },
      missedOpportunities: { increment: (delta.missedOpportunities ?? 0) * mult },
      totalMissedValue: { increment: (delta.totalMissedValue ?? 0) * mult },
      battingMissedCount: { increment: (delta.battingMissedCount ?? 0) * mult },
      battingMissedValue: { increment: (delta.battingMissedValue ?? 0) * mult },
      fieldingMissedCount: { increment: (delta.fieldingMissedCount ?? 0) * mult },
      fieldingMissedValue: { increment: (delta.fieldingMissedValue ?? 0) * mult },
      battingGainedRe: { increment: (delta.battingGainedRe ?? 0) * mult },
      fieldingGainedRe: { increment: (delta.fieldingGainedRe ?? 0) * mult },
      badChallenges: { increment: (delta.badChallenges ?? 0) * mult },
    },
  });
}

async function applyTeamDayBucket(
  teamId: number,
  gameDate: string,
  season: number,
  delta: TeamBucketDelta,
  sign: 1 | -1
): Promise<void> {
  const mult = sign;
  await prisma.teamRankingDayBucket.upsert({
    where: {
      teamId_gameDate_season: { teamId, gameDate, season },
    },
    create: {
      teamId,
      gameDate,
      season,
      challengesUsed: (delta.challengesUsed ?? 0) * mult,
      challengesOverturned: (delta.challengesOverturned ?? 0) * mult,
      battingMissedCount: (delta.battingMissedCount ?? 0) * mult,
      battingMissedValue: (delta.battingMissedValue ?? 0) * mult,
      fieldingMissedCount: (delta.fieldingMissedCount ?? 0) * mult,
      fieldingMissedValue: (delta.fieldingMissedValue ?? 0) * mult,
      battingGainedRe: (delta.battingGainedRe ?? 0) * mult,
      fieldingGainedRe: (delta.fieldingGainedRe ?? 0) * mult,
      badChallenges: (delta.badChallenges ?? 0) * mult,
    },
    update: {
      challengesUsed: { increment: (delta.challengesUsed ?? 0) * mult },
      challengesOverturned: { increment: (delta.challengesOverturned ?? 0) * mult },
      battingMissedCount: { increment: (delta.battingMissedCount ?? 0) * mult },
      battingMissedValue: { increment: (delta.battingMissedValue ?? 0) * mult },
      fieldingMissedCount: { increment: (delta.fieldingMissedCount ?? 0) * mult },
      fieldingMissedValue: { increment: (delta.fieldingMissedValue ?? 0) * mult },
      battingGainedRe: { increment: (delta.battingGainedRe ?? 0) * mult },
      fieldingGainedRe: { increment: (delta.fieldingGainedRe ?? 0) * mult },
      badChallenges: { increment: (delta.badChallenges ?? 0) * mult },
    },
  });
}

async function applyPlayerSeasonTotal(
  playerId: number,
  season: number,
  delta: PlayerBucketDelta,
  sign: 1 | -1
): Promise<void> {
  const mult = sign;
  await prisma.playerRankingSeasonTotal.upsert({
    where: { playerId_season: { playerId, season } },
    create: {
      playerId,
      season,
      challengesUsed: (delta.challengesUsed ?? 0) * mult,
      challengesOverturned: (delta.challengesOverturned ?? 0) * mult,
      missedOpportunities: (delta.missedOpportunities ?? 0) * mult,
      totalMissedValue: (delta.totalMissedValue ?? 0) * mult,
      battingMissedCount: (delta.battingMissedCount ?? 0) * mult,
      battingMissedValue: (delta.battingMissedValue ?? 0) * mult,
      fieldingMissedCount: (delta.fieldingMissedCount ?? 0) * mult,
      fieldingMissedValue: (delta.fieldingMissedValue ?? 0) * mult,
      battingGainedRe: (delta.battingGainedRe ?? 0) * mult,
      fieldingGainedRe: (delta.fieldingGainedRe ?? 0) * mult,
      badChallenges: (delta.badChallenges ?? 0) * mult,
    },
    update: {
      challengesUsed: { increment: (delta.challengesUsed ?? 0) * mult },
      challengesOverturned: { increment: (delta.challengesOverturned ?? 0) * mult },
      missedOpportunities: { increment: (delta.missedOpportunities ?? 0) * mult },
      totalMissedValue: { increment: (delta.totalMissedValue ?? 0) * mult },
      battingMissedCount: { increment: (delta.battingMissedCount ?? 0) * mult },
      battingMissedValue: { increment: (delta.battingMissedValue ?? 0) * mult },
      fieldingMissedCount: { increment: (delta.fieldingMissedCount ?? 0) * mult },
      fieldingMissedValue: { increment: (delta.fieldingMissedValue ?? 0) * mult },
      battingGainedRe: { increment: (delta.battingGainedRe ?? 0) * mult },
      fieldingGainedRe: { increment: (delta.fieldingGainedRe ?? 0) * mult },
      badChallenges: { increment: (delta.badChallenges ?? 0) * mult },
    },
  });
}

async function applyTeamSeasonTotal(
  teamId: number,
  season: number,
  delta: TeamBucketDelta,
  sign: 1 | -1
): Promise<void> {
  const mult = sign;
  await prisma.teamRankingSeasonTotal.upsert({
    where: { teamId_season: { teamId, season } },
    create: {
      teamId,
      season,
      challengesUsed: (delta.challengesUsed ?? 0) * mult,
      challengesOverturned: (delta.challengesOverturned ?? 0) * mult,
      battingMissedCount: (delta.battingMissedCount ?? 0) * mult,
      battingMissedValue: (delta.battingMissedValue ?? 0) * mult,
      fieldingMissedCount: (delta.fieldingMissedCount ?? 0) * mult,
      fieldingMissedValue: (delta.fieldingMissedValue ?? 0) * mult,
      battingGainedRe: (delta.battingGainedRe ?? 0) * mult,
      fieldingGainedRe: (delta.fieldingGainedRe ?? 0) * mult,
      badChallenges: (delta.badChallenges ?? 0) * mult,
    },
    update: {
      challengesUsed: { increment: (delta.challengesUsed ?? 0) * mult },
      challengesOverturned: { increment: (delta.challengesOverturned ?? 0) * mult },
      battingMissedCount: { increment: (delta.battingMissedCount ?? 0) * mult },
      battingMissedValue: { increment: (delta.battingMissedValue ?? 0) * mult },
      fieldingMissedCount: { increment: (delta.fieldingMissedCount ?? 0) * mult },
      fieldingMissedValue: { increment: (delta.fieldingMissedValue ?? 0) * mult },
      battingGainedRe: { increment: (delta.battingGainedRe ?? 0) * mult },
      fieldingGainedRe: { increment: (delta.fieldingGainedRe ?? 0) * mult },
      badChallenges: { increment: (delta.badChallenges ?? 0) * mult },
    },
  });
}

export async function applyRankingsDelta(
  gameDate: string,
  season: number,
  delta: {
    playerDeltas: PlayerBucketDelta[];
    teamDeltas: TeamBucketDelta[];
    playerAppearanceIds: number[];
  },
  gamePk: number,
  sign: 1 | -1 = 1,
  options?: { skipSeasonTotals?: boolean }
): Promise<void> {
  const skipSeasonTotals = options?.skipSeasonTotals ?? false;

  for (const playerDelta of delta.playerDeltas) {
    await applyPlayerDayBucket(playerDelta.playerId, gameDate, season, playerDelta, sign);
    if (!skipSeasonTotals) {
      await applyPlayerSeasonTotal(playerDelta.playerId, season, playerDelta, sign);
    }
  }

  for (const teamDelta of delta.teamDeltas) {
    await applyTeamDayBucket(teamDelta.teamId, gameDate, season, teamDelta, sign);
    if (!skipSeasonTotals) {
      await applyTeamSeasonTotal(teamDelta.teamId, season, teamDelta, sign);
    }
  }

  if (sign === 1) {
    for (const playerId of delta.playerAppearanceIds) {
      await prisma.rankingPlayerGameAppearance.upsert({
        where: { playerId_gamePk: { playerId, gamePk } },
        create: { playerId, gamePk, gameDate, season },
        update: {},
      });
    }
  }
}

export async function recordTeamGameAppearances(
  gamePk: number,
  gameDate: string,
  season: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<void> {
  for (const teamId of [homeTeamId, awayTeamId]) {
    await prisma.rankingTeamGameAppearance.upsert({
      where: { teamId_gamePk: { teamId, gamePk } },
      create: { teamId, gamePk, gameDate, season },
      update: {},
    });
  }
}

/**
 * Reverse rankings contributions for games being purged by data retention.
 *
 * Only the per-day buckets are reversed here — day buckets are only ever
 * queried within a recent rolling window (see resolveRankingsPeriod), so once
 * a game falls outside the retention window its bucket row is already dead
 * weight. Season totals are intentionally left untouched: they are meant to
 * accumulate for the whole season regardless of how long raw game rows are
 * retained (mirrors the player-stat-snapshot exclusion noted in
 * cleanupRepository.ts). Reversing them here would silently turn "season"
 * rankings into just another rolling window matching DATA_RETENTION_DAYS.
 *
 * Game-appearance rows (used for "gamesAppeared" in both week and season
 * reads — season reads count appearances across the whole tracking window,
 * not just the retention window) are intentionally NOT deleted for the same
 * reason: they have no FK dependency on the purged Game/pitch rows, and
 * removing them would silently undercount season-long games-appeared totals.
 */
export async function purgeRankingsForGames(gamePks: number[]): Promise<number> {
  if (gamePks.length === 0) return 0;

  const contributions = await prisma.rankingsContribution.findMany({
    where: { gamePk: { in: gamePks } },
  });

  for (const contribution of contributions) {
    const delta = contribution.payloadJson as unknown as {
      playerDeltas: PlayerBucketDelta[];
      teamDeltas: TeamBucketDelta[];
      playerAppearanceIds: number[];
    };
    await applyRankingsDelta(
      contribution.gameDate,
      contribution.season,
      delta,
      contribution.gamePk,
      -1,
      { skipSeasonTotals: true }
    );
  }

  await prisma.rankingsContribution.deleteMany({
    where: { gamePk: { in: gamePks } },
  });

  return contributions.length;
}
