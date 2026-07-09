import { HttpError } from "../utils/httpErrors";
import {
  BRANCH_SCHEMA_VERSION,
  type BranchCheckpoint,
  type BranchDocument,
  type BranchForkSnapshot,
  type BranchRunners,
  type BranchSituation,
  type TeamBranchState,
} from "./branchTypes";

const DEFENSE_SLOTS = [
  "pitcher",
  "catcher",
  "first",
  "second",
  "third",
  "shortstop",
  "left",
  "center",
  "right",
] as const;

const MAX_BATTING_ORDER = 30;
const MAX_BENCH = 40;
const MAX_BULLPEN = 25;
const MAX_REMOVED = 50;
const MAX_PLAYER_NAMES = 120;
const MAX_NAME_LENGTH = 80;
const MAX_INNING = 30;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

function parsePlayerIdArray(value: unknown, maxLen: number, field: string): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Invalid ${field}: expected array`);
  }
  if (value.length > maxLen) {
    throw new HttpError(400, `Invalid ${field}: too many entries`);
  }
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!isPositiveInt(item)) {
      throw new HttpError(400, `Invalid ${field}: expected positive integers`);
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function parseRunners(value: unknown): BranchRunners {
  if (!isPlainObject(value)) return {};
  const runners: BranchRunners = {};
  for (const base of ["first", "second", "third"] as const) {
    const id = value[base];
    if (id === undefined) continue;
    if (!isPositiveInt(id)) {
      throw new HttpError(400, `Invalid runners.${base}`);
    }
    runners[base] = id;
  }
  return runners;
}

function parseDefense(value: unknown): TeamBranchState["defense"] {
  if (!isPlainObject(value)) return {};
  const defense: TeamBranchState["defense"] = {};
  for (const slot of DEFENSE_SLOTS) {
    const id = value[slot];
    if (id === undefined) continue;
    if (!isPositiveInt(id)) {
      throw new HttpError(400, `Invalid defense.${slot}`);
    }
    defense[slot] = id;
  }
  return defense;
}

function parseTeamState(value: unknown, side: "home" | "away"): TeamBranchState {
  if (!isPlainObject(value)) {
    throw new HttpError(400, `Invalid teams.${side}`);
  }
  if (!isPositiveInt(value.teamId)) {
    throw new HttpError(400, `Invalid teams.${side}.teamId`);
  }
  return {
    teamId: value.teamId,
    battingOrder: parsePlayerIdArray(value.battingOrder, MAX_BATTING_ORDER, `teams.${side}.battingOrder`),
    bench: parsePlayerIdArray(value.bench ?? [], MAX_BENCH, `teams.${side}.bench`),
    bullpen: parsePlayerIdArray(value.bullpen ?? [], MAX_BULLPEN, `teams.${side}.bullpen`),
    defense: parseDefense(value.defense),
    removedFromGame: parsePlayerIdArray(
      value.removedFromGame ?? [],
      MAX_REMOVED,
      `teams.${side}.removedFromGame`
    ),
  };
}

function parseSituation(value: unknown): BranchSituation {
  if (!isPlainObject(value)) {
    throw new HttpError(400, "Invalid situation");
  }
  if (!isPositiveInt(value.inning) || value.inning > MAX_INNING) {
    throw new HttpError(400, "Invalid situation.inning");
  }
  if (value.halfInning !== "top" && value.halfInning !== "bottom") {
    throw new HttpError(400, "Invalid situation.halfInning");
  }
  if (!isNonNegativeInt(value.balls, 3)) throw new HttpError(400, "Invalid situation.balls");
  if (!isNonNegativeInt(value.strikes, 2)) throw new HttpError(400, "Invalid situation.strikes");
  if (!isNonNegativeInt(value.outs, 3)) throw new HttpError(400, "Invalid situation.outs");
  if (!isNonNegativeInt(value.homeScore, 99)) throw new HttpError(400, "Invalid situation.homeScore");
  if (!isNonNegativeInt(value.awayScore, 99)) throw new HttpError(400, "Invalid situation.awayScore");
  if (!isPositiveInt(value.batterId)) throw new HttpError(400, "Invalid situation.batterId");
  if (!isPositiveInt(value.pitcherId)) throw new HttpError(400, "Invalid situation.pitcherId");
  if (!isPositiveInt(value.battingTeamId)) throw new HttpError(400, "Invalid situation.battingTeamId");
  if (!isPositiveInt(value.fieldingTeamId)) throw new HttpError(400, "Invalid situation.fieldingTeamId");
  if (!isNonNegativeInt(value.homeChallengesRemaining, 5)) {
    throw new HttpError(400, "Invalid situation.homeChallengesRemaining");
  }
  if (!isNonNegativeInt(value.awayChallengesRemaining, 5)) {
    throw new HttpError(400, "Invalid situation.awayChallengesRemaining");
  }

  return {
    inning: value.inning,
    halfInning: value.halfInning,
    balls: value.balls,
    strikes: value.strikes,
    outs: value.outs,
    runners: parseRunners(value.runners),
    homeScore: value.homeScore,
    awayScore: value.awayScore,
    batterId: value.batterId,
    pitcherId: value.pitcherId,
    battingTeamId: value.battingTeamId,
    fieldingTeamId: value.fieldingTeamId,
    homeChallengesRemaining: value.homeChallengesRemaining,
    awayChallengesRemaining: value.awayChallengesRemaining,
  };
}

function parseCheckpoint(value: unknown): BranchCheckpoint {
  if (!isPlainObject(value)) return {};
  const checkpoint: BranchCheckpoint = {};
  if (value.atBatIndex !== undefined) {
    if (!isNonNegativeInt(value.atBatIndex, 500)) {
      throw new HttpError(400, "Invalid checkpoint.atBatIndex");
    }
    checkpoint.atBatIndex = value.atBatIndex;
  }
  if (value.label !== undefined) {
    if (typeof value.label !== "string" || value.label.length > 120) {
      throw new HttpError(400, "Invalid checkpoint.label");
    }
    checkpoint.label = value.label;
  }
  return checkpoint;
}

function parsePlayerNames(value: unknown): Record<number, string> {
  if (!isPlainObject(value)) return {};
  const names: Record<number, string> = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    if (count >= MAX_PLAYER_NAMES) break;
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (typeof raw !== "string") continue;
    const name = raw.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) continue;
    names[id] = name;
    count += 1;
  }
  return names;
}

function parseSchedule(value: unknown, parentGamePk: number): BranchDocument["schedule"] {
  if (!isPlainObject(value)) {
    throw new HttpError(400, "Invalid schedule");
  }
  if (!isPositiveInt(value.gamePk)) {
    throw new HttpError(400, "Invalid schedule.gamePk");
  }
  if (value.gamePk !== parentGamePk) {
    throw new HttpError(400, "schedule.gamePk must match parentGamePk");
  }
  if (typeof value.officialDate !== "string" || value.officialDate.length > 20) {
    throw new HttpError(400, "Invalid schedule.officialDate");
  }
  if (typeof value.scheduledStartTime !== "string" || value.scheduledStartTime.length > 40) {
    throw new HttpError(400, "Invalid schedule.scheduledStartTime");
  }
  if (
    value.abstractState !== "Preview" &&
    value.abstractState !== "Live" &&
    value.abstractState !== "Final"
  ) {
    throw new HttpError(400, "Invalid schedule.abstractState");
  }
  if (typeof value.detailedState !== "string" || value.detailedState.length > 40) {
    throw new HttpError(400, "Invalid schedule.detailedState");
  }
  if (!isPositiveInt(value.homeTeamId) || !isPositiveInt(value.awayTeamId)) {
    throw new HttpError(400, "Invalid schedule team ids");
  }
  for (const field of ["homeTeamName", "homeTeamAbbrev", "awayTeamName", "awayTeamAbbrev"] as const) {
    if (typeof value[field] !== "string" || value[field].length > 80) {
      throw new HttpError(400, `Invalid schedule.${field}`);
    }
  }

  const homeTeamName = value.homeTeamName as string;
  const homeTeamAbbrev = value.homeTeamAbbrev as string;
  const awayTeamName = value.awayTeamName as string;
  const awayTeamAbbrev = value.awayTeamAbbrev as string;
  const officialDate = value.officialDate as string;
  const scheduledStartTime = value.scheduledStartTime as string;
  const detailedState = value.detailedState as string;
  const abstractState = value.abstractState as "Preview" | "Live" | "Final";

  const nullableInt = (v: unknown, max: number): number | null => {
    if (v === null || v === undefined) return null;
    return isNonNegativeInt(v, max) ? v : null;
  };

  return {
    gamePk: value.gamePk,
    officialDate,
    scheduledStartTime,
    abstractState,
    detailedState,
    homeTeamId: value.homeTeamId,
    homeTeamName,
    homeTeamAbbrev,
    awayTeamId: value.awayTeamId,
    awayTeamName,
    awayTeamAbbrev,
    homeScore: nullableInt(value.homeScore, 99),
    awayScore: nullableInt(value.awayScore, 99),
    currentInning: nullableInt(value.currentInning, MAX_INNING),
    currentInningHalf:
      value.currentInningHalf === null || value.currentInningHalf === undefined
        ? null
        : typeof value.currentInningHalf === "string"
          ? value.currentInningHalf.slice(0, 8)
          : null,
    balls: nullableInt(value.balls, 3),
    strikes: nullableInt(value.strikes, 2),
    outs: nullableInt(value.outs, 3),
    isTracked: value.isTracked === true,
    hasTriggeredRecommendation: value.hasTriggeredRecommendation === true,
    homeChallengesRemaining: nullableInt(value.homeChallengesRemaining, 5),
    awayChallengesRemaining: nullableInt(value.awayChallengesRemaining, 5),
  };
}

function parseForkSnapshot(
  raw: unknown,
  fallback: {
    situation: BranchSituation;
    teams: { home: TeamBranchState; away: TeamBranchState };
    checkpoint: BranchCheckpoint;
    playerNames: Record<number, string>;
  }
): BranchForkSnapshot {
  if (!isPlainObject(raw)) {
    return {
      situation: structuredClone(fallback.situation),
      teams: structuredClone(fallback.teams),
      checkpoint: { ...fallback.checkpoint },
      playerNames: { ...fallback.playerNames },
    };
  }

  return {
    situation: parseSituation(raw.situation ?? fallback.situation),
    teams: {
      home: parseTeamState(raw.teams && isPlainObject(raw.teams) ? raw.teams.home : fallback.teams.home, "home"),
      away: parseTeamState(raw.teams && isPlainObject(raw.teams) ? raw.teams.away : fallback.teams.away, "away"),
    },
    checkpoint: parseCheckpoint(raw.checkpoint ?? fallback.checkpoint),
    playerNames: parsePlayerNames(raw.playerNames ?? fallback.playerNames),
  };
}

function parseForkedAt(value: unknown): string {
  if (typeof value !== "string" || value.length > 40) {
    return new Date().toISOString();
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }
  return new Date(parsed).toISOString();
}

export function sanitizeSituationPatch(
  patch: unknown,
  current: BranchSituation
): BranchSituation {
  if (!isPlainObject(patch)) {
    throw new HttpError(400, "Invalid situation");
  }
  const merged: BranchSituation = {
    ...current,
    ...patch,
    runners:
      patch.runners !== undefined
        ? parseRunners({ ...current.runners, ...(isPlainObject(patch.runners) ? patch.runners : {}) })
        : current.runners,
  };
  return parseSituation(merged);
}

export function sanitizeTeamStatePatch(
  patch: unknown,
  current: TeamBranchState,
  side: "home" | "away"
): TeamBranchState {
  if (!isPlainObject(patch)) {
    throw new HttpError(400, `Invalid teams.${side}`);
  }
  const merged = {
    teamId: current.teamId,
    battingOrder: patch.battingOrder ?? current.battingOrder,
    bench: patch.bench ?? current.bench,
    bullpen: patch.bullpen ?? current.bullpen,
    defense:
      patch.defense !== undefined
        ? parseDefense(
            isPlainObject(patch.defense)
              ? { ...current.defense, ...patch.defense }
              : current.defense
          )
        : current.defense,
    removedFromGame: patch.removedFromGame ?? current.removedFromGame,
  };
  return parseTeamState(merged, side);
}

export function sanitizePlayerNamesPatch(patch: unknown): Record<number, string> {
  if (!isPlainObject(patch)) {
    throw new HttpError(400, "Invalid playerNames");
  }
  return parsePlayerNames(patch);
}

export function clearPreviewCache(doc: BranchDocument): BranchDocument {
  return {
    ...doc,
    previewGrid: undefined,
    previewGridComputedAt: undefined,
  };
}

/**
 * Parse and sanitize a branch document from an import or restore request.
 * Strips unknown fields and rejects malformed payloads.
 */
export function sanitizeBranchImport(body: unknown, expectedBranchId?: string): BranchDocument {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "Invalid branch document");
  }

  if (body.schemaVersion !== BRANCH_SCHEMA_VERSION) {
    throw new HttpError(400, "Unsupported branch schema version");
  }

  if (expectedBranchId !== undefined) {
    if (typeof body.branchId !== "string" || body.branchId !== expectedBranchId) {
      throw new HttpError(400, "branchId mismatch");
    }
  } else if (typeof body.branchId === "string" && body.branchId.length > 64) {
    throw new HttpError(400, "Invalid branchId");
  }

  if (!isPositiveInt(body.parentGamePk)) {
    throw new HttpError(400, "Invalid parentGamePk");
  }

  const situation = parseSituation(body.situation);
  const teams = {
    home: parseTeamState(isPlainObject(body.teams) ? body.teams.home : undefined, "home"),
    away: parseTeamState(isPlainObject(body.teams) ? body.teams.away : undefined, "away"),
  };
  const checkpoint = parseCheckpoint(body.checkpoint);
  const playerNames = parsePlayerNames(body.playerNames);
  const schedule = parseSchedule(body.schedule, body.parentGamePk);
  const forkSnapshot = parseForkSnapshot(body.forkSnapshot, {
    situation,
    teams,
    checkpoint,
    playerNames,
  });

  return {
    schemaVersion: BRANCH_SCHEMA_VERSION,
    branchId: typeof body.branchId === "string" ? body.branchId : "",
    parentGamePk: body.parentGamePk,
    forkedAt: parseForkedAt(body.forkedAt),
    checkpoint,
    schedule,
    playerNames,
    teams,
    situation,
    forkSnapshot,
    lineupIncomplete: body.lineupIncomplete === true,
    // Drop cached preview on import/restore — must be recomputed server-side.
    atBatHistory: undefined,
    previewGrid: undefined,
    previewGridComputedAt: undefined,
  };
}
