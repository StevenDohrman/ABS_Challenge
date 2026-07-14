import { prisma } from "./prisma";
import { SEASONS } from "./constants";
import { loadPlayerNamesByIds } from "./playerNameRepository";
import type {
  PlayerRankingRow,
  TeamRankingRow,
} from "../services/rankingsService";
import { getTeamInfo } from "../utils/mlbTeams";

export type RankingsReadMode = "week" | "season";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function playerHasActivity(row: {
  challengesUsed: number;
  missedOpportunities: number;
  battingMissedCount: number;
  fieldingMissedCount: number;
  badChallenges: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
}): boolean {
  return (
    row.challengesUsed > 0 ||
    row.missedOpportunities > 0 ||
    row.battingMissedCount > 0 ||
    row.fieldingMissedCount > 0 ||
    row.badChallenges > 0 ||
    row.battingGainedRe > 0 ||
    row.fieldingGainedRe > 0
  );
}

function teamHasActivity(row: {
  challengesUsed: number;
  battingMissedCount: number;
  fieldingMissedCount: number;
  badChallenges: number;
  battingGainedRe: number;
  fieldingGainedRe: number;
}): boolean {
  return (
    row.challengesUsed > 0 ||
    row.battingMissedCount > 0 ||
    row.fieldingMissedCount > 0 ||
    row.badChallenges > 0 ||
    row.battingGainedRe > 0 ||
    row.fieldingGainedRe > 0
  );
}

async function countPlayerAppearances(
  playerIds: number[],
  periodStart: string,
  periodEnd: string
): Promise<Map<number, number>> {
  if (playerIds.length === 0) return new Map();

  const rows = await prisma.rankingPlayerGameAppearance.groupBy({
    by: ["playerId"],
    where: {
      playerId: { in: playerIds },
      gameDate: { gte: periodStart, lte: periodEnd },
    },
    _count: { gamePk: true },
  });

  return new Map(rows.map((r) => [r.playerId, r._count.gamePk]));
}

async function countTeamAppearances(
  teamIds: number[],
  periodStart: string,
  periodEnd: string
): Promise<Map<number, number>> {
  if (teamIds.length === 0) return new Map();

  const rows = await prisma.rankingTeamGameAppearance.groupBy({
    by: ["teamId"],
    where: {
      teamId: { in: teamIds },
      gameDate: { gte: periodStart, lte: periodEnd },
    },
    _count: { gamePk: true },
  });

  return new Map(rows.map((r) => [r.teamId, r._count.gamePk]));
}

export async function countTrackedGames(
  periodStart: string,
  periodEnd: string
): Promise<number> {
  return prisma.game.count({
    where: { gameDate: { gte: periodStart, lte: periodEnd } },
  });
}

export async function fetchPlayerRankingRows(
  mode: RankingsReadMode,
  periodStart: string,
  periodEnd: string
): Promise<PlayerRankingRow[]> {
  const season = SEASONS.CURRENT;

  type Agg = {
    playerId: number;
    challengesUsed: number;
    challengesOverturned: number;
    missedOpportunities: number;
    totalMissedValue: number;
    battingMissedCount: number;
    battingMissedValue: number;
    fieldingMissedCount: number;
    fieldingMissedValue: number;
    battingGainedRe: number;
    fieldingGainedRe: number;
    badChallenges: number;
  };

  const byPlayer = new Map<number, Agg>();

  if (mode === "season") {
    const rows = await prisma.playerRankingSeasonTotal.findMany({
      where: { season },
    });
    for (const row of rows) {
      byPlayer.set(row.playerId, { ...row });
    }
  } else {
    const buckets = await prisma.playerRankingDayBucket.findMany({
      where: {
        season,
        gameDate: { gte: periodStart, lte: periodEnd },
      },
    });
    for (const bucket of buckets) {
      let acc = byPlayer.get(bucket.playerId);
      if (!acc) {
        acc = {
          playerId: bucket.playerId,
          challengesUsed: 0,
          challengesOverturned: 0,
          missedOpportunities: 0,
          totalMissedValue: 0,
          battingMissedCount: 0,
          battingMissedValue: 0,
          fieldingMissedCount: 0,
          fieldingMissedValue: 0,
          battingGainedRe: 0,
          fieldingGainedRe: 0,
          badChallenges: 0,
        };
        byPlayer.set(bucket.playerId, acc);
      }
      acc.challengesUsed += bucket.challengesUsed;
      acc.challengesOverturned += bucket.challengesOverturned;
      acc.missedOpportunities += bucket.missedOpportunities;
      acc.totalMissedValue += bucket.totalMissedValue;
      acc.battingMissedCount += bucket.battingMissedCount;
      acc.battingMissedValue += bucket.battingMissedValue;
      acc.fieldingMissedCount += bucket.fieldingMissedCount;
      acc.fieldingMissedValue += bucket.fieldingMissedValue;
      acc.battingGainedRe += bucket.battingGainedRe;
      acc.fieldingGainedRe += bucket.fieldingGainedRe;
      acc.badChallenges += bucket.badChallenges;
    }
  }

  const active = [...byPlayer.values()].filter(playerHasActivity);
  const playerIds = active.map((r) => r.playerId);
  const [names, appearances] = await Promise.all([
    loadPlayerNamesByIds(playerIds),
    countPlayerAppearances(playerIds, periodStart, periodEnd),
  ]);

  return active.map((acc) => {
    const splitMissedValue = acc.battingMissedValue + acc.fieldingMissedValue;
    const totalMissedValue =
      splitMissedValue > 0 ? splitMissedValue : acc.totalMissedValue;
    const splitMissedCount = acc.battingMissedCount + acc.fieldingMissedCount;
    const missedOpportunities =
      splitMissedCount > 0 ? splitMissedCount : acc.missedOpportunities;

    return {
      rank: 0,
      playerId: acc.playerId,
      playerName: names.get(acc.playerId) ?? `Player ${acc.playerId}`,
      challengesUsed: acc.challengesUsed,
      challengesOverturned: acc.challengesOverturned,
      overturnRate: rate(acc.challengesOverturned, acc.challengesUsed),
      missedOpportunities,
      battingMissedCount: acc.battingMissedCount,
      battingMissedValue: round3(acc.battingMissedValue),
      fieldingMissedCount: acc.fieldingMissedCount,
      fieldingMissedValue: round3(acc.fieldingMissedValue),
      totalMissedValue: round3(totalMissedValue),
      battingGainedRe: round3(acc.battingGainedRe),
      fieldingGainedRe: round3(acc.fieldingGainedRe),
      totalGainedRe: round3(acc.battingGainedRe + acc.fieldingGainedRe),
      badChallenges: acc.badChallenges,
      gamesAppeared: appearances.get(acc.playerId) ?? 0,
    };
  });
}

export async function fetchTeamRankingRows(
  mode: RankingsReadMode,
  periodStart: string,
  periodEnd: string
): Promise<TeamRankingRow[]> {
  const season = SEASONS.CURRENT;

  type Agg = {
    teamId: number;
    challengesUsed: number;
    challengesOverturned: number;
    battingMissedCount: number;
    battingMissedValue: number;
    fieldingMissedCount: number;
    fieldingMissedValue: number;
    battingGainedRe: number;
    fieldingGainedRe: number;
    badChallenges: number;
  };

  const byTeam = new Map<number, Agg>();

  if (mode === "season") {
    const rows = await prisma.teamRankingSeasonTotal.findMany({
      where: { season },
    });
    for (const row of rows) {
      byTeam.set(row.teamId, { ...row });
    }
  } else {
    const buckets = await prisma.teamRankingDayBucket.findMany({
      where: {
        season,
        gameDate: { gte: periodStart, lte: periodEnd },
      },
    });
    for (const bucket of buckets) {
      let acc = byTeam.get(bucket.teamId);
      if (!acc) {
        acc = {
          teamId: bucket.teamId,
          challengesUsed: 0,
          challengesOverturned: 0,
          battingMissedCount: 0,
          battingMissedValue: 0,
          fieldingMissedCount: 0,
          fieldingMissedValue: 0,
          battingGainedRe: 0,
          fieldingGainedRe: 0,
          badChallenges: 0,
        };
        byTeam.set(bucket.teamId, acc);
      }
      acc.challengesUsed += bucket.challengesUsed;
      acc.challengesOverturned += bucket.challengesOverturned;
      acc.battingMissedCount += bucket.battingMissedCount;
      acc.battingMissedValue += bucket.battingMissedValue;
      acc.fieldingMissedCount += bucket.fieldingMissedCount;
      acc.fieldingMissedValue += bucket.fieldingMissedValue;
      acc.battingGainedRe += bucket.battingGainedRe;
      acc.fieldingGainedRe += bucket.fieldingGainedRe;
      acc.badChallenges += bucket.badChallenges;
    }
  }

  const active = [...byTeam.values()].filter(teamHasActivity);
  const teamIds = active.map((r) => r.teamId);
  const appearances = await countTeamAppearances(teamIds, periodStart, periodEnd);

  return active.map((acc) => {
    const info = getTeamInfo(acc.teamId);
    return {
      rank: 0,
      teamId: acc.teamId,
      teamAbbrev: info.abbrev,
      teamName: info.name,
      challengesUsed: acc.challengesUsed,
      challengesOverturned: acc.challengesOverturned,
      overturnRate: rate(acc.challengesOverturned, acc.challengesUsed),
      battingMissedCount: acc.battingMissedCount,
      battingMissedValue: round3(acc.battingMissedValue),
      fieldingMissedCount: acc.fieldingMissedCount,
      fieldingMissedValue: round3(acc.fieldingMissedValue),
      totalMissedValue: round3(acc.battingMissedValue + acc.fieldingMissedValue),
      battingGainedRe: round3(acc.battingGainedRe),
      fieldingGainedRe: round3(acc.fieldingGainedRe),
      totalGainedRe: round3(acc.battingGainedRe + acc.fieldingGainedRe),
      badChallenges: acc.badChallenges,
      gamesAppeared: appearances.get(acc.teamId) ?? 0,
    };
  });
}
