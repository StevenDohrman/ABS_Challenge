import type { Request, Response } from "express";
import {
  countTrackedGames,
  fetchPlayerRankingRows,
  fetchTeamRankingRows,
} from "../db/rankingsRepository";
import {
  parseRankingsSortOptions,
  rankPlayerRows,
  rankTeamRows,
} from "../services/rankingsService";
import { resolveRankingsPeriod } from "../utils/rankingsPeriod";
import type {
  PlayerRankingsResponseDto,
  RankingsBundleResponseDto,
  TeamRankingsResponseDto,
} from "../challenge.dto";

function buildMeta(
  period: ReturnType<typeof resolveRankingsPeriod>,
  sortOptions: ReturnType<typeof parseRankingsSortOptions>,
  gameCount: number
) {
  return {
    period: period.period,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    periodLabel: period.label,
    trackingStartDate: period.trackingStartDate,
    windowDays: period.windowDays,
    sort: sortOptions.sort,
    order: sortOptions.order,
    gameCount,
  };
}

/** GET /api/rankings — precomputed totals; sort applied in memory. */
export async function getRankingsBundle(
  req: Request,
  res: Response
): Promise<void> {
  const period = resolveRankingsPeriod(req.query["period"]);
  const sortOptions = parseRankingsSortOptions(req.query["sort"], req.query["order"]);

  const [playerRows, teamRows, gameCount] = await Promise.all([
    fetchPlayerRankingRows(period.period, period.periodStart, period.periodEnd),
    fetchTeamRankingRows(period.period, period.periodStart, period.periodEnd),
    countTrackedGames(period.periodStart, period.periodEnd),
  ]);

  const dto: RankingsBundleResponseDto = {
    ...buildMeta(period, sortOptions, gameCount),
    players: rankPlayerRows(playerRows, sortOptions),
    teams: rankTeamRows(teamRows, sortOptions),
  };

  res.json(dto);
}

export async function getPlayerRankings(
  req: Request,
  res: Response
): Promise<void> {
  const period = resolveRankingsPeriod(req.query["period"]);
  const sortOptions = parseRankingsSortOptions(req.query["sort"], req.query["order"]);

  const [rows, gameCount] = await Promise.all([
    fetchPlayerRankingRows(period.period, period.periodStart, period.periodEnd),
    countTrackedGames(period.periodStart, period.periodEnd),
  ]);

  const dto: PlayerRankingsResponseDto = {
    ...buildMeta(period, sortOptions, gameCount),
    rows: rankPlayerRows(rows, sortOptions),
  };

  res.json(dto);
}

export async function getTeamRankings(
  req: Request,
  res: Response
): Promise<void> {
  const period = resolveRankingsPeriod(req.query["period"]);
  const sortOptions = parseRankingsSortOptions(req.query["sort"], req.query["order"]);

  const [rows, gameCount] = await Promise.all([
    fetchTeamRankingRows(period.period, period.periodStart, period.periodEnd),
    countTrackedGames(period.periodStart, period.periodEnd),
  ]);

  const dto: TeamRankingsResponseDto = {
    ...buildMeta(period, sortOptions, gameCount),
    rows: rankTeamRows(rows, sortOptions),
  };

  res.json(dto);
}
