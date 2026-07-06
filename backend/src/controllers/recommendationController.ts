import type { Request, Response } from "express";
import { getLatestRecommendationForGame } from "../services/challengeService";
import { toRecommendationDto, toAtBatGridDto, toGameAtBatHistoryDto } from "../challenge.dto";
import { prisma } from "../db/prisma";
import { findAllForAtBat, findAllForGame } from "../db/recommendationRepository";
import { parseGamePkParam } from "../utils/requestParams";

/**
 * GET /api/games/:gamePk/recommendation
 *
 * Responses:
 *   200  ChallengeRecommendationResponseDto
 *   204  Game tracked but no triggered recommendation yet
 *   404  Game not found
 */
export async function getLatestRecommendation(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseGamePkParam(req);
  const context = await getLatestRecommendationForGame(gamePk);

  if (!context) {
    const gameExists = await prisma.game.findUnique({ where: { gamePk } });
    res.status(gameExists ? 204 : 404).end();
    return;
  }

  res.json(toRecommendationDto(context.recommendation, context.snapshot));
}

/**
 * GET /api/games/:gamePk/at-bats/current/recommendations
 *
 * Responses:
 *   200  AtBatRecommendationGridResponseDto
 *   204  No at-bat snapshot yet
 *   404  Game not found
 */
export async function getCurrentAtBatRecommendations(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseGamePkParam(req);

  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) {
    res.status(404).end();
    return;
  }

  const latestSnapshot = await prisma.liveGameSnapshot.findFirst({
    where: { gamePk },
    orderBy: { atBatIndex: "desc" },
  });

  if (!latestSnapshot) {
    res.status(204).end();
    return;
  }

  const rows = await findAllForAtBat(gamePk, latestSnapshot.atBatIndex);
  const halfInningLabel = latestSnapshot.halfInning === "top" ? "Top" : "Bot";

  res.json(
    toAtBatGridDto(
      gamePk,
      latestSnapshot.atBatIndex,
      rows,
      latestSnapshot.inning,
      halfInningLabel
    )
  );
}

/**
 * GET /api/games/:gamePk/at-bats
 *
 * Responses:
 *   200  GameAtBatHistoryDto
 *   204  Game tracked, no at-bats ingested yet
 *   404  Game not found
 */
export async function getGameAtBatHistory(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseGamePkParam(req);

  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) {
    res.status(404).end();
    return;
  }

  const [snapshots, allRecs, reviewPitchEvents, postgameAudits] = await Promise.all([
    prisma.liveGameSnapshot.findMany({
      where: { gamePk },
      orderBy: { atBatIndex: "asc" },
    }),
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

  if (snapshots.length === 0) {
    res.status(204).end();
    return;
  }

  const auditsByAtBat = new Map(postgameAudits.map((a) => [a.atBatIndex, a]));

  res.json(
    toGameAtBatHistoryDto(gamePk, snapshots, allRecs, reviewPitchEvents, auditsByAtBat)
  );
}
