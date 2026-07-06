import type { Request } from "express";
import { HttpError } from "./httpErrors";

/** Parse :gamePk route param; throws HttpError(400) when invalid. */
export function parseGamePkParam(req: Request): number {
  const gamePk = parseInt(String(req.params["gamePk"]), 10);
  if (isNaN(gamePk)) {
    throw new HttpError(400, "gamePk must be a number");
  }
  return gamePk;
}
