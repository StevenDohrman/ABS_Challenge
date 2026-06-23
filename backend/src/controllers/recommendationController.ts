import type { Request, Response } from "express";
import { getLatestRecommendationForGame } from "../services/challengeService";
import { toRecommendationDto } from "../challenge.dto";
import { prisma } from "../db/prisma";

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
