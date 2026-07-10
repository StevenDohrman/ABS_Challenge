import type { Request, Response } from "express";
import { parseGamePkParam } from "../utils/requestParams";
import { HttpError } from "../utils/httpErrors";
import { findGameLineups } from "../db/lineupRepository";
import type { GameLineupsResponseDto } from "../branch/branchTypes";

/** GET /api/games/:gamePk/lineups */
export async function getGameLineups(req: Request, res: Response): Promise<void> {
  const gamePk = parseGamePkParam(req);
  const rows = await findGameLineups(gamePk);

  if (rows.length === 0) {
    res.status(204).end();
    return;
  }

  const dto: GameLineupsResponseDto = {
    gamePk,
    lineups: rows.map((r) => ({
      teamId: r.teamId,
      playerId: r.playerId,
      battingOrder: r.battingOrder,
    })),
  };
  res.json(dto);
}
