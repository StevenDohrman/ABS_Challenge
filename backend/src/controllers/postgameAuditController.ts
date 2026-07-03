import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { findAuditsForGame } from "../db/postgameAuditRepository";
import {
  toPostgameAuditResponseDto,
  type PostgameAuditStatus,
} from "../challenge.dto";

/**
 * GET /api/games/:gamePk/postgame-audit
 *
 * Returns postgame challenge audit summary including total missed value,
 * top 3 missed opportunities, and the full missed-challenges list.
 */
export async function getPostgameAudit(
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

  const audits = await findAuditsForGame(gamePk);

  let status: PostgameAuditStatus;
  if (game.postgameAuditedAt) {
    status = "ready";
  } else if (game.status === "Final") {
    status = "pending";
  } else {
    status = "unavailable";
  }

  const dto = toPostgameAuditResponseDto(
    gamePk,
    status,
    game.postgameAuditedAt,
    audits,
    { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId }
  );
  res.json(dto);
}
