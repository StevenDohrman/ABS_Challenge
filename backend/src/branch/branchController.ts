import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { parseGamePkParam } from "../utils/requestParams";
import { HttpError } from "../utils/httpErrors";
import {
  buildGameExportBundle,
  BranchNotEligibleError,
} from "../services/gameExportService";
import { computeBranchPreviewGrid } from "../services/branchPreviewService";
import { getBranchEligibility } from "../services/branchEligibilityService";
import {
  parseBranchSessionCookie,
  saveBranch,
  getBranch,
  updateBranch,
  deleteBranch,
} from "../branch/branchSessionStore";
import {
  BRANCH_SCHEMA_VERSION,
  type BranchDocument,
  type BranchForkSnapshot,
} from "../branch/branchTypes";
import {
  sanitizeBranchImport,
  clearPreviewCache,
  sanitizePlayerNamesPatch,
  sanitizeSituationPatch,
  sanitizeTeamStatePatch,
} from "./branchImportValidation";

function sessionIdFromReq(req: Request): string | null {
  return parseBranchSessionCookie(req.headers.cookie);
}

function setSessionCookie(res: Response, cookie: string): void {
  res.append("Set-Cookie", cookie);
}

function requireBranchSession(req: Request): string {
  const sessionId = sessionIdFromReq(req);
  if (!sessionId) throw new HttpError(401, "Branch session required");
  return sessionId;
}

function loadOwnedBranch(req: Request, branchId: string): BranchDocument {
  const doc = getBranch(branchId, requireBranchSession(req));
  if (!doc) throw new HttpError(404, "Branch not found");
  return doc;
}

function cloneForkSnapshot(
  bundle: Awaited<ReturnType<typeof buildGameExportBundle>>
): BranchForkSnapshot {
  return {
    situation: structuredClone(bundle.situation),
    teams: {
      home: { ...bundle.teams.home, removedFromGame: [] },
      away: { ...bundle.teams.away, removedFromGame: [] },
    },
    checkpoint: structuredClone(bundle.checkpoint),
    playerNames: { ...bundle.playerNames },
  };
}

function exportToBranchDocument(
  bundle: Awaited<ReturnType<typeof buildGameExportBundle>>,
  branchId: string
): BranchDocument {
  const forkSnapshot = cloneForkSnapshot(bundle);
  return {
    schemaVersion: BRANCH_SCHEMA_VERSION,
    branchId,
    parentGamePk: bundle.gamePk,
    forkedAt: bundle.exportedAt,
    checkpoint: bundle.checkpoint,
    schedule: bundle.schedule,
    playerNames: bundle.playerNames,
    teams: {
      home: { ...bundle.teams.home, removedFromGame: [] },
      away: { ...bundle.teams.away, removedFromGame: [] },
    },
    situation: bundle.situation,
    forkSnapshot,
    lineupIncomplete: bundle.lineupIncomplete,
    atBatHistory: bundle.atBatHistory,
  };
}

/** GET /api/games/:gamePk/branch-eligibility */
export async function getBranchEligibilityHandler(
  req: Request,
  res: Response
): Promise<void> {
  const gamePk = parseGamePkParam(req);
  res.json(await getBranchEligibility(gamePk));
}

/**
 * POST /api/branches
 * Body: { gamePk: number, checkpointAtBatIndex?: number }
 */
export async function createBranch(req: Request, res: Response): Promise<void> {
  const body = req.body as { gamePk?: number; checkpointAtBatIndex?: number };
  const gamePk = body.gamePk;
  if (typeof gamePk !== "number" || !Number.isFinite(gamePk)) {
    throw new HttpError(400, "gamePk is required");
  }

  let bundle;
  try {
    bundle = await buildGameExportBundle(gamePk, {
      checkpointAtBatIndex: body.checkpointAtBatIndex,
    });
  } catch (err) {
    if (err instanceof BranchNotEligibleError) {
      throw new HttpError(409, err.message);
    }
    if (err instanceof Error && err.message === "Game not found") {
      throw new HttpError(404, err.message);
    }
    console.error("[branchController] createBranch export failed:", err);
    const message = err instanceof Error ? err.message : "Export failed";
    throw new HttpError(422, message);
  }

  const branchId = randomUUID();
  const doc = exportToBranchDocument(bundle, branchId);

  try {
    const { cookie } = saveBranch(doc, sessionIdFromReq(req));
    setSessionCookie(res, cookie);
  } catch (err) {
    throw new HttpError(413, err instanceof Error ? err.message : "Branch too large");
  }

  res.status(201).json({ branchId, branch: doc });
}

export async function getBranchHandler(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  res.json(loadOwnedBranch(req, branchId));
}

export async function patchBranch(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const sessionId = requireBranchSession(req);
  const body = req.body as {
    situation?: unknown;
    teams?: { home?: unknown; away?: unknown };
    playerNames?: unknown;
  };

  const updated = updateBranch(branchId, sessionId, (doc) => {
    let next: BranchDocument = { ...doc };

    if (body.situation !== undefined) {
      next = clearPreviewCache({
        ...next,
        situation: sanitizeSituationPatch(body.situation, doc.situation),
      });
    }
    if (body.teams !== undefined) {
      next = clearPreviewCache({
        ...next,
        teams: {
          home:
            body.teams.home !== undefined
              ? sanitizeTeamStatePatch(body.teams.home, doc.teams.home, "home")
              : doc.teams.home,
          away:
            body.teams.away !== undefined
              ? sanitizeTeamStatePatch(body.teams.away, doc.teams.away, "away")
              : doc.teams.away,
        },
      });
    }
    if (body.playerNames !== undefined) {
      const namesPatch = sanitizePlayerNamesPatch(body.playerNames);
      next = clearPreviewCache({
        ...next,
        playerNames: { ...doc.playerNames, ...namesPatch },
      });
    }

    return next;
  });

  if (!updated) throw new HttpError(404, "Branch not found");
  res.json(updated);
}

/** POST /api/branches/:branchId/reset */
export async function resetBranchToFork(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const sessionId = requireBranchSession(req);

  const updated = updateBranch(branchId, sessionId, (doc) => {
    const snap = doc.forkSnapshot;
    if (!snap) return doc;
    return clearPreviewCache({
      ...doc,
      situation: structuredClone(snap.situation),
      teams: structuredClone(snap.teams),
      checkpoint: structuredClone(snap.checkpoint),
      playerNames: { ...snap.playerNames },
    });
  });

  if (!updated) throw new HttpError(404, "Branch not found");
  res.json(updated);
}

/** POST /api/branches/:branchId/restore — rehydrate branch from client cache after server restart. */
export async function restoreBranchHandler(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const doc = sanitizeBranchImport(req.body, branchId);

  try {
    const { cookie } = saveBranch(doc, sessionIdFromReq(req));
    setSessionCookie(res, cookie);
  } catch (err) {
    throw new HttpError(413, err instanceof Error ? err.message : "Branch too large");
  }

  res.json(doc);
}

export async function deleteBranchHandler(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const ok = deleteBranch(branchId, requireBranchSession(req));
  if (!ok) throw new HttpError(404, "Branch not found");
  res.status(204).end();
}

export async function exportBranch(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const doc = loadOwnedBranch(req, branchId);
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="game-${doc.parentGamePk}-branch.abs-branch.json"`
  );
  res.json(doc);
}

export async function importBranch(req: Request, res: Response): Promise<void> {
  const sanitized = sanitizeBranchImport(req.body);
  const branchId = randomUUID();
  const doc: BranchDocument = { ...sanitized, branchId };

  try {
    const { cookie } = saveBranch(doc, sessionIdFromReq(req));
    setSessionCookie(res, cookie);
  } catch (err) {
    throw new HttpError(413, err instanceof Error ? err.message : "Branch too large");
  }

  res.status(201).json({ branchId, branch: doc });
}

export async function previewBranchGrid(req: Request, res: Response): Promise<void> {
  const branchId = String(req.params["branchId"]);
  const sessionId = requireBranchSession(req);
  const doc = getBranch(branchId, sessionId);
  if (!doc) throw new HttpError(404, "Branch not found");

  const grid = await computeBranchPreviewGrid(doc);
  const computedAt = new Date().toISOString();

  updateBranch(branchId, sessionId, (current) => ({
    ...current,
    previewGrid: grid,
    previewGridComputedAt: computedAt,
  }));

  res.json({ grid, computedAt });
}

export async function getGameExport(req: Request, res: Response): Promise<void> {
  const gamePk = parseGamePkParam(req);
  const atBatParam = req.query["atBatIndex"];
  const checkpointAtBatIndex =
    typeof atBatParam === "string" ? parseInt(atBatParam, 10) : undefined;

  try {
    const bundle = await buildGameExportBundle(gamePk, {
      checkpointAtBatIndex: Number.isFinite(checkpointAtBatIndex)
        ? checkpointAtBatIndex
        : undefined,
    });
    res.json(bundle);
  } catch (err) {
    if (err instanceof BranchNotEligibleError) {
      throw new HttpError(409, err.message);
    }
    if (err instanceof Error && err.message === "Game not found") {
      throw new HttpError(404, err.message);
    }
    console.error("[branchController] getGameExport failed:", err);
    const message = err instanceof Error ? err.message : "Export failed";
    throw new HttpError(422, message);
  }
}
