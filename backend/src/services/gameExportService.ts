import {
  fetchLiveFeed,
  parseGameLineups,
  parseGameSnapshot,
  parseGameBench,
  parseGameBullpen,
  parsePlayerNamesFromFeed,
  assessBranchRosterFromFeed,
  resolveTeamDefenses,
  resolveGameDataTeamIds,
  type DefensiveLineup,
} from "@abs/data-pipeline";
import { prisma } from "../db/prisma";
import { findGameLineups } from "../db/lineupRepository";
import { loadPlayerNamesByIds } from "../db/playerNameRepository";
import { findAllForGame } from "../db/recommendationRepository";
import { toGameAtBatHistoryDto } from "../dto/recommendation";
import type { GameAbstractState, ScheduleGameDto } from "../dto/schedule";
import type {
  BranchCheckpoint,
  BranchSituation,
  GameExportBundleDto,
  TeamBranchState,
} from "../branch/branchTypes";
import { GAME_RULES } from "../db/constants";
import { BranchNotEligibleError } from "./branchEligibilityService";

export { BranchNotEligibleError };

export interface ExportOptions {
  checkpointAtBatIndex?: number;
  skipEligibilityCheck?: boolean;
}

function formatHalf(half?: string): string | null {
  if (!half) return null;
  const lower = half.toLowerCase();
  if (lower === "top") return "Top";
  if (lower === "bottom") return "Bot";
  return half;
}

function normalizeLiveOuts(outs: number | null): number | null {
  if (outs === null) return null;
  return Math.min(Math.max(0, outs), 2);
}

function buildScheduleFromFeed(
  feed: Awaited<ReturnType<typeof fetchLiveFeed>>,
  tracked: boolean,
  challenges: { home: number | null; away: number | null }
): ScheduleGameDto {
  const { gameData, liveData } = feed;
  const abstractState = gameData.status.abstractGameState as GameAbstractState;
  const isLive = abstractState === "Live";
  const ls = liveData.linescore;
  const { homeTeamId, awayTeamId, homeTeam, awayTeam } = resolveGameDataTeamIds(feed);

  return {
    gamePk: feed.gamePk,
    officialDate: gameData.datetime.officialDate,
    scheduledStartTime: gameData.datetime.dateTime,
    abstractState,
    detailedState: gameData.status.detailedState,
    homeTeamId,
    homeTeamName: homeTeam?.name ?? "",
    homeTeamAbbrev: homeTeam?.abbreviation ?? "",
    awayTeamId,
    awayTeamName: awayTeam?.name ?? "",
    awayTeamAbbrev: awayTeam?.abbreviation ?? "",
    homeScore: ls?.teams?.home?.runs ?? null,
    awayScore: ls?.teams?.away?.runs ?? null,
    currentInning: isLive ? (ls?.currentInning ?? null) : null,
    currentInningHalf: isLive ? formatHalf(ls?.inningHalf) : null,
    balls: isLive ? (ls?.balls ?? null) : null,
    strikes: isLive ? (ls?.strikes ?? null) : null,
    outs: isLive ? normalizeLiveOuts(ls?.outs ?? null) : null,
    isTracked: tracked,
    hasTriggeredRecommendation: false,
    homeChallengesRemaining: challenges.home,
    awayChallengesRemaining: challenges.away,
  };
}

function lineupRowsToOrder(
  rows: Array<{ teamId: number; playerId: number; battingOrder: number }>,
  teamId: number
): number[] {
  return rows
    .filter((r) => r.teamId === teamId)
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((r) => r.playerId);
}

function resolveBattingOrder(order: number[], batters: number[]): number[] {
  const cleaned = order.filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  return batters.filter(Boolean).slice(0, 9);
}

function emptyDefense(): DefensiveLineup {
  return {};
}

function buildTeamState(
  teamId: number,
  battingOrder: number[],
  bench: number[],
  bullpen: number[],
  defense: DefensiveLineup
): Omit<TeamBranchState, "removedFromGame"> {
  return { teamId, battingOrder, bench, bullpen, defense };
}

function probablePitcherId(
  feed: Awaited<ReturnType<typeof fetchLiveFeed>>,
  side: "home" | "away"
): number | undefined {
  const prob = feed.gameData.probablePitchers?.[side]?.id;
  if (prob) return prob;
  const box = feed.liveData.boxscore?.teams?.[side];
  const pitchers = (box?.pitchers ?? []).filter(Boolean);
  if (pitchers.length > 0) return pitchers[0];
  const bullpen = (box?.bullpen ?? []).filter(Boolean);
  if (bullpen.length > 0) return bullpen[0];
  return undefined;
}

function snapshotToSituation(
  snap: {
    inning: number;
    halfInning: string;
    outs: number;
    runnerOnFirst: boolean;
    runnerOnSecond: boolean;
    runnerOnThird: boolean;
    runnerFirstId?: number | null;
    runnerSecondId?: number | null;
    runnerThirdId?: number | null;
    homeScore: number;
    awayScore: number;
    batterId: number;
    pitcherId: number;
    battingTeamId: number;
    fieldingTeamId: number;
  },
  homeChallenges: number,
  awayChallenges: number,
  liveCount?: { balls: number; strikes: number }
): BranchSituation {
  const half = snap.halfInning === "bottom" ? "bottom" : "top";
  return {
    inning: snap.inning,
    halfInning: half,
    balls: liveCount?.balls ?? 0,
    strikes: liveCount?.strikes ?? 0,
    outs: Math.min(Math.max(0, snap.outs), 2),
    runners: {
      first: snap.runnerOnFirst ? snap.runnerFirstId ?? undefined : undefined,
      second: snap.runnerOnSecond ? snap.runnerSecondId ?? undefined : undefined,
      third: snap.runnerOnThird ? snap.runnerThirdId ?? undefined : undefined,
    },
    homeScore: snap.homeScore,
    awayScore: snap.awayScore,
    batterId: snap.batterId,
    pitcherId: snap.pitcherId,
    battingTeamId: snap.battingTeamId,
    fieldingTeamId: snap.fieldingTeamId,
    homeChallengesRemaining: homeChallenges,
    awayChallengesRemaining: awayChallenges,
  };
}

function seedPregameSituation(
  feed: Awaited<ReturnType<typeof fetchLiveFeed>>,
  homeTeamId: number,
  awayTeamId: number,
  homeOrder: number[],
  awayOrder: number[],
  homeChallenges: number,
  awayChallenges: number,
  schedule: ScheduleGameDto
): BranchSituation {
  const liveSnapshot = parseGameSnapshot(feed, new Date().toISOString());
  const offense = feed.liveData.linescore?.offense;
  const defensePitcher = feed.liveData.linescore?.defense?.pitcher?.id;

  if (liveSnapshot.batterId && liveSnapshot.pitcherId) {
    const half = liveSnapshot.halfInning;
    return {
      inning: liveSnapshot.inning,
      halfInning: half,
      balls: liveSnapshot.balls,
      strikes: liveSnapshot.strikes,
      outs: liveSnapshot.outs,
      runners: {
        first: liveSnapshot.runnerOnFirst ? offense?.first?.id : undefined,
        second: liveSnapshot.runnerOnSecond ? offense?.second?.id : undefined,
        third: liveSnapshot.runnerOnThird ? offense?.third?.id : undefined,
      },
      homeScore: liveSnapshot.homeScore,
      awayScore: liveSnapshot.awayScore,
      batterId: liveSnapshot.batterId,
      pitcherId: liveSnapshot.pitcherId,
      battingTeamId: half === "top" ? awayTeamId : homeTeamId,
      fieldingTeamId: half === "top" ? homeTeamId : awayTeamId,
      homeChallengesRemaining: homeChallenges,
      awayChallengesRemaining: awayChallenges,
    };
  }

  const awayBatter = awayOrder[0] ?? 0;
  const homePitcher =
    defensePitcher ?? probablePitcherId(feed, "home") ?? homeOrder[0] ?? 0;

  return {
    inning: 1,
    halfInning: "top",
    balls: 0,
    strikes: 0,
    outs: 0,
    runners: {},
    homeScore: schedule.homeScore ?? 0,
    awayScore: schedule.awayScore ?? 0,
    batterId: awayBatter,
    pitcherId: homePitcher,
    battingTeamId: awayTeamId,
    fieldingTeamId: homeTeamId,
    homeChallengesRemaining: homeChallenges,
    awayChallengesRemaining: awayChallenges,
  };
}

/**
 * Assemble a read-only fork bundle from canonical DB + one MLB live feed fetch.
 * No branch or fork rows are written to the database.
 */
export async function buildGameExportBundle(
  gamePk: number,
  options: ExportOptions = {}
): Promise<GameExportBundleDto> {
  const [dbGame, feed] = await Promise.all([
    prisma.game.findUnique({ where: { gamePk } }),
    fetchLiveFeed(gamePk).catch(() => null),
  ]);

  if (!feed && !dbGame) {
    throw new Error("Game not found");
  }

  const assessment = feed ? assessBranchRosterFromFeed(feed) : null;

  if (feed && !options.skipEligibilityCheck && assessment && !assessment.eligible) {
    throw new BranchNotEligibleError(assessment.reason, assessment);
  }

  const tracked = dbGame != null;
  const homeChallenges =
    dbGame?.homeChallengesRemaining ?? GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM;
  const awayChallenges =
    dbGame?.awayChallengesRemaining ?? GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM;

  const schedule = feed
    ? buildScheduleFromFeed(feed, tracked, {
        home: homeChallenges,
        away: awayChallenges,
      })
    : ({
        gamePk,
        officialDate: dbGame!.gameDate,
        scheduledStartTime: dbGame!.gameDate,
        abstractState: (dbGame!.status === "Final" ? "Final" : "Preview") as GameAbstractState,
        detailedState: dbGame!.status,
        homeTeamId: dbGame!.homeTeamId,
        homeTeamName: String(dbGame!.homeTeamId),
        homeTeamAbbrev: "",
        awayTeamId: dbGame!.awayTeamId,
        awayTeamName: String(dbGame!.awayTeamId),
        awayTeamAbbrev: "",
        homeScore: null,
        awayScore: null,
        currentInning: null,
        currentInningHalf: null,
        balls: null,
        strikes: null,
        outs: null,
        isTracked: tracked,
        hasTriggeredRecommendation: false,
        homeChallengesRemaining: homeChallenges,
        awayChallengesRemaining: awayChallenges,
      } satisfies ScheduleGameDto);

  const homeTeamId = schedule.homeTeamId;
  const awayTeamId = schedule.awayTeamId;

  let dbLineupRows = await findGameLineups(gamePk);
  if (dbLineupRows.length === 0 && feed) {
    const parsed = parseGameLineups(feed, new Date().toISOString());
    dbLineupRows = parsed.map((e) => ({
      id: 0,
      gamePk: e.gamePk,
      teamId: e.teamId,
      playerId: e.playerId,
      battingOrder: e.battingOrder,
      fetchedAt: new Date(e.fetchedAt),
      updatedAt: new Date(),
    }));
  }

  const lineupDto = dbLineupRows.map((r) => ({
    teamId: r.teamId,
    playerId: r.playerId,
    battingOrder: r.battingOrder,
  }));

  const boxBatters = feed
    ? {
        home: feed.liveData.boxscore?.teams?.home?.batters ?? [],
        away: feed.liveData.boxscore?.teams?.away?.batters ?? [],
      }
    : { home: [] as number[], away: [] as number[] };

  const homeOrder = resolveBattingOrder(
    lineupRowsToOrder(lineupDto, homeTeamId),
    boxBatters.home
  );
  const awayOrder = resolveBattingOrder(
    lineupRowsToOrder(lineupDto, awayTeamId),
    boxBatters.away
  );

  const bench = feed ? parseGameBench(feed) : { home: [], away: [] };
  const bullpen = feed ? parseGameBullpen(feed) : { home: [], away: [] };
  const liveSnapshot = feed ? parseGameSnapshot(feed, new Date().toISOString()) : null;

  const snapshots = await prisma.liveGameSnapshot.findMany({
    where: { gamePk },
    orderBy: { atBatIndex: "asc" },
  });

  let checkpoint: BranchCheckpoint = { label: "Pregame / warmup" };
  let situationSeed = snapshots.at(-1);

  if (options.checkpointAtBatIndex != null) {
    situationSeed =
      snapshots.find((s) => s.atBatIndex === options.checkpointAtBatIndex) ??
      situationSeed;
    checkpoint = {
      atBatIndex: options.checkpointAtBatIndex,
      label: `At-bat ${options.checkpointAtBatIndex}`,
    };
  } else if (situationSeed) {
    checkpoint = {
      atBatIndex: situationSeed.atBatIndex,
      label: "Latest snapshot",
    };
  }

  let situation: BranchSituation;
  if (situationSeed) {
    situation = snapshotToSituation(
      situationSeed,
      homeChallenges,
      awayChallenges,
      liveSnapshot
        ? { balls: liveSnapshot.balls, strikes: liveSnapshot.strikes }
        : undefined
    );
  } else if (feed) {
    situation = seedPregameSituation(
      feed,
      homeTeamId,
      awayTeamId,
      homeOrder,
      awayOrder,
      homeChallenges,
      awayChallenges,
      schedule
    );
  } else {
    situation = {
      inning: 1,
      halfInning: "top",
      balls: 0,
      strikes: 0,
      outs: 0,
      runners: {},
      homeScore: schedule.homeScore ?? 0,
      awayScore: schedule.awayScore ?? 0,
      batterId: awayOrder[0] ?? 0,
      pitcherId: homeOrder[0] ?? 0,
      battingTeamId: awayTeamId,
      fieldingTeamId: homeTeamId,
      homeChallengesRemaining: homeChallenges,
      awayChallengesRemaining: awayChallenges,
    };
  }

  const defenses = feed
    ? resolveTeamDefenses(feed)
    : { home: emptyDefense(), away: emptyDefense() };

  const teams = {
    home: buildTeamState(homeTeamId, homeOrder, bench.home, bullpen.home, defenses.home),
    away: buildTeamState(awayTeamId, awayOrder, bench.away, bullpen.away, defenses.away),
  };

  const playerIdSet = new Set<number>();
  for (const id of [
    ...homeOrder,
    ...awayOrder,
    ...bench.home,
    ...bench.away,
    ...bullpen.home,
    ...bullpen.away,
    situation.batterId,
    situation.pitcherId,
    situation.runners.first,
    situation.runners.second,
    situation.runners.third,
  ]) {
    if (id) playerIdSet.add(id);
  }

  const feedNames = feed ? parsePlayerNamesFromFeed(feed) : {};
  const playerNamesMap = await loadPlayerNamesByIds([...playerIdSet]);
  const playerNames: Record<number, string> = { ...feedNames };
  for (const [id, name] of playerNamesMap) {
    if (!playerNames[id]) playerNames[id] = name;
  }

  let atBatHistory;
  if (snapshots.length > 0) {
    const [allRecs, reviewPitchEvents, postgameAudits] = await Promise.all([
      findAllForGame(gamePk),
      prisma.livePitchEvent.findMany({
        where: { gamePk, hasReview: true },
        select: {
          atBatIndex: true,
          isOverturned: true,
          challengerName: true,
          challengerTeamId: true,
        },
      }),
      prisma.postgameChallengeAudit.findMany({ where: { gamePk } }),
    ]);
    const auditsByAtBat = new Map(postgameAudits.map((a) => [a.atBatIndex, a]));
    atBatHistory = toGameAtBatHistoryDto(
      gamePk,
      snapshots,
      allRecs,
      reviewPitchEvents,
      auditsByAtBat
    );
  }

  return {
    gamePk,
    exportedAt: new Date().toISOString(),
    schedule,
    playerNames,
    lineups: lineupDto,
    lineupIncomplete:
      assessment?.lineupIncomplete ?? (homeOrder.length < 9 || awayOrder.length < 9),
    teams,
    situation,
    checkpoint,
    atBatHistory,
  };
}
