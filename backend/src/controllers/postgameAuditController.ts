import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { findAuditsForGame } from "../db/postgameAuditRepository";
import {
  toPostgameAuditResponseDto,
  type PostgameAuditStatus,
} from "../challenge.dto";
import { parseGamePkParam } from "../utils/requestParams";

/**
 * GET /api/games/:gamePk/postgame-audit
 */
export async function getPostgameAudit(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseGamePkParam(req);

  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) {
    res.status(404).end();
    return;
  }

  const audits = await findAuditsForGame(gamePk);

  let status: PostgameAuditStatus;
  if (game.postgameAuditedAt) {
    status = "ready";
  } else if (game.status === "Final") {
    status = "pending";
  } else {
    status = "unavailable";
  }

  res.json(
    toPostgameAuditResponseDto(gamePk, status, game.postgameAuditedAt, audits, {
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
    })
  );
}
