import type { Request, Response } from "express";
import { getLatestRecommendationForGame } from "../services/challengeService";
import { toRecommendationDto, toAtBatGridDto, toGameAtBatHistoryDto } from "../challenge.dto";
import { prisma } from "../db/prisma";
import { findAllForAtBat, findAllForGame } from "../db/recommendationRepository";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/games/:gamePk/recommendation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the most recently triggered challenge recommendation for a game.
 *
 * Triggered means a called-strike pitch was received at this count state and
 * the engine's pre-computed output for that count was activated.
 *
 * Responses:
 *   200  ChallengeRecommendationResponseDto — a recommendation has been triggered
 *   204  No content — game is tracked but no called-strike pitch yet this game
 *   404  Game not found in the system
 */
export async function getLatestRecommendation(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseInt(String(req.params["gamePk"]), 10);

  if (isNaN(gamePk)) {
    res.status(400).json({ error: "gamePk must be a number" });
    return;
  }

  const context = await getLatestRecommendationForGame(gamePk);

  if (!context) {
    const gameExists = await prisma.game.findUnique({ where: { gamePk } });
    res.status(gameExists ? 204 : 404).end();
    return;
  }

  const dto = toRecommendationDto(context.recommendation, context.snapshot);
  res.json(dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/games/:gamePk/at-bats/current/recommendations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all 12 pre-computed recommendations for the current at-bat.
 *
 * Used by the pre-at-bat banner before any pitch is thrown. The response
 * includes a summary sentence plus the full count-state grid.
 *
 * Responses:
 *   200  AtBatRecommendationGridResponseDto
 *   204  No at-bat snapshot yet (game tracked, no at-bat ingested)
 *   404  Game not found
 */
export async function getCurrentAtBatRecommendations(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseInt(String(req.params["gamePk"]), 10);

  if (isNaN(gamePk)) {
    res.status(400).json({ error: "gamePk must be a number" });
    return;
  }

  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) {
    res.status(404).end();
    return;
  }

  // Find the most recent at-bat snapshot to get the current atBatIndex.
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
  const dto = toAtBatGridDto(gamePk, latestSnapshot.atBatIndex, rows, latestSnapshot.inning, halfInningLabel);
  res.json(dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/games/:gamePk/at-bats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the full at-bat history for a game: every ingested at-bat with all
 * 12 pre-computed recommendations and which count was triggered (if any).
 *
 * Used by the post-game (and in-game history) view.
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
  const gamePk = parseInt(String(req.params["gamePk"]), 10);

  if (isNaN(gamePk)) {
    res.status(400).json({ error: "gamePk must be a number" });
    return;
  }

  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) {
    res.status(404).end();
    return;
  }

  const [snapshots, allRecs] = await Promise.all([
    prisma.liveGameSnapshot.findMany({
      where: { gamePk },
      orderBy: { atBatIndex: "asc" },
    }),
    findAllForGame(gamePk),
  ]);

  if (snapshots.length === 0) {
    res.status(204).end();
    return;
  }

  const dto = toGameAtBatHistoryDto(gamePk, snapshots, allRecs);
  res.json(dto);
}
