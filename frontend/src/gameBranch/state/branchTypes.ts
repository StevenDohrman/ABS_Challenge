import type {
  ScheduleGame,
  AtBatRecommendationGridResponse,
  GameAtBatHistoryResponse,
} from "../../api/types";
import {
  hasBlockingWarning,
  isBlowout,
  validateDefensiveSubstitution,
  validatePinchHit,
  validatePitcherChange,
} from "../rules/substitutions";
import { resolveOuts } from "../rules/inningProgression";

export const BRANCH_SCHEMA_VERSION = 1 as const;

export interface BranchCheckpoint {
  atBatIndex?: number;
  label?: string;
}

export interface BranchRunners {
  first?: number;
  second?: number;
  third?: number;
}

export interface DefensiveLineup {
  pitcher?: number;
  catcher?: number;
  first?: number;
  second?: number;
  third?: number;
  shortstop?: number;
  left?: number;
  center?: number;
  right?: number;
}

export interface BranchSituation {
  inning: number;
  halfInning: "top" | "bottom";
  balls: number;
  strikes: number;
  outs: number;
  runners: BranchRunners;
  homeScore: number;
  awayScore: number;
  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  fieldingTeamId: number;
  homeChallengesRemaining: number;
  awayChallengesRemaining: number;
}

export interface TeamBranchState {
  teamId: number;
  battingOrder: number[];
  bench: number[];
  bullpen: number[];
  defense: DefensiveLineup;
  removedFromGame: number[];
}

export interface BranchForkSnapshot {
  situation: BranchSituation;
  teams: { home: TeamBranchState; away: TeamBranchState };
  checkpoint: BranchCheckpoint;
  playerNames: Record<number, string>;
}

export interface BranchDocument {
  schemaVersion: typeof BRANCH_SCHEMA_VERSION;
  branchId: string;
  parentGamePk: number;
  forkedAt: string;
  checkpoint: BranchCheckpoint;
  schedule: ScheduleGame;
  playerNames: Record<number, string>;
  teams: { home: TeamBranchState; away: TeamBranchState };
  situation: BranchSituation;
  forkSnapshot?: BranchForkSnapshot;
  lineupIncomplete?: boolean;
  atBatHistory?: GameAtBatHistoryResponse;
  previewGrid?: AtBatRecommendationGridResponse;
  previewGridComputedAt?: string;
}

export interface BranchEligibility {
  gamePk: number;
  eligible: boolean;
  reason: string;
  lineupIncomplete: boolean;
  warmupStarted: boolean;
  roster: {
    home: { lineup: number; bench: number; bullpen: number };
    away: { lineup: number; bench: number; bullpen: number };
  };
}

export type BranchSide = "home" | "away";

export type BranchAction =
  | { type: "LOAD"; doc: BranchDocument }
  | { type: "PATCH_SITUATION"; patch: Partial<BranchSituation> }
  | { type: "SET_RUNNER"; base: keyof BranchRunners; playerId?: number }
  | { type: "PATCH_TEAMS"; side: BranchSide; patch: Partial<TeamBranchState> }
  | { type: "SWAP_BENCH_TO_LINEUP"; side: BranchSide; slotIndex: number; benchPlayerId: number }
  | { type: "CHANGE_PITCHER"; side: BranchSide; pitcherId: number }
  | { type: "SET_DEFENSE_SLOT"; side: BranchSide; slot: keyof DefensiveLineup; playerId: number }
  | { type: "APPLY_PLAY"; situation: BranchSituation }
  | { type: "PATCH_CHALLENGES"; home: number; away: number }
  | { type: "RESET_TO_FORK" }
  | { type: "SET_PREVIEW_GRID"; grid: AtBatRecommendationGridResponse; computedAt: string };

function clearPreview<T extends BranchDocument>(doc: T): T {
  return { ...doc, previewGrid: undefined, previewGridComputedAt: undefined };
}

function teamBySide(doc: BranchDocument, side: BranchSide): TeamBranchState {
  return doc.teams[side];
}

function stripPlayerFromDefense(
  defense: DefensiveLineup,
  playerId: number
): DefensiveLineup {
  const next: DefensiveLineup = { ...defense };
  for (const key of Object.keys(next) as (keyof DefensiveLineup)[]) {
    if (next[key] === playerId) delete next[key];
  }
  return next;
}

export function branchReducer(
  state: BranchDocument | null,
  action: BranchAction
): BranchDocument | null {
  if (action.type === "LOAD") return action.doc;
  if (!state) return state;

  switch (action.type) {
    case "PATCH_SITUATION": {
      const merged = {
        ...state.situation,
        ...action.patch,
        runners: action.patch.runners
          ? { ...state.situation.runners, ...action.patch.runners }
          : state.situation.runners,
      };
      return clearPreview({
        ...state,
        situation: resolveOuts(state, merged),
      });
    }
    case "SET_RUNNER": {
      const runners = { ...state.situation.runners };
      if (action.playerId == null) delete runners[action.base];
      else {
        for (const b of ["first", "second", "third"] as const) {
          if (b !== action.base && runners[b] === action.playerId) delete runners[b];
        }
        runners[action.base] = action.playerId;
      }
      return clearPreview({
        ...state,
        situation: { ...state.situation, runners },
      });
    }
    case "PATCH_TEAMS": {
      return clearPreview({
        ...state,
        teams: {
          ...state.teams,
          [action.side]: { ...teamBySide(state, action.side), ...action.patch },
        },
      });
    }
    case "SWAP_BENCH_TO_LINEUP": {
      const team = teamBySide(state, action.side);
      const replaced = team.battingOrder[action.slotIndex];
      if (!replaced) return state;
      const blowout = isBlowout(state.situation);
      const warnings = validatePinchHit(
        team,
        replaced,
        action.benchPlayerId,
        team.removedFromGame,
        blowout
      );
      if (hasBlockingWarning(warnings)) return state;

      const order = [...team.battingOrder];
      order[action.slotIndex] = action.benchPlayerId;
      const bench = team.bench.filter((id) => id !== action.benchPlayerId);
      const removed = team.removedFromGame.includes(replaced)
        ? team.removedFromGame
        : [...team.removedFromGame, replaced];

      const runners = { ...state.situation.runners };
      for (const base of ["first", "second", "third"] as const) {
        if (runners[base] === replaced) delete runners[base];
      }

      return clearPreview({
        ...state,
        teams: {
          ...state.teams,
          [action.side]: { ...team, battingOrder: order, bench, removedFromGame: removed },
        },
        situation: {
          ...(state.situation.batterId === replaced
            ? { ...state.situation, batterId: action.benchPlayerId, runners }
            : { ...state.situation, runners }),
        },
      });
    }
    case "CHANGE_PITCHER": {
      const team = teamBySide(state, action.side);
      const blowout = isBlowout(state.situation);
      const warnings = validatePitcherChange(
        team,
        action.pitcherId,
        team.removedFromGame,
        blowout
      );
      if (hasBlockingWarning(warnings)) return state;

      const oldPitcher = team.defense.pitcher;
      const removed = [...team.removedFromGame];
      if (oldPitcher && !removed.includes(oldPitcher)) removed.push(oldPitcher);

      const incoming = action.pitcherId;
      let bench = [...team.bench];
      let bullpen = [...team.bullpen];
      if (bench.includes(incoming)) bench = bench.filter((id) => id !== incoming);
      if (bullpen.includes(incoming)) bullpen = bullpen.filter((id) => id !== incoming);

      const defense = { ...team.defense, pitcher: incoming };

      const next = clearPreview({
        ...state,
        teams: {
          ...state.teams,
          [action.side]: { ...team, defense, bench, bullpen, removedFromGame: removed },
        },
      });
      if (state.situation.fieldingTeamId === team.teamId) {
        next.situation = { ...next.situation, pitcherId: action.pitcherId };
      }
      return next;
    }
    case "SET_DEFENSE_SLOT": {
      const team = teamBySide(state, action.side);
      if (action.slot === "pitcher") {
        return branchReducer(state, {
          type: "CHANGE_PITCHER",
          side: action.side,
          pitcherId: action.playerId,
        });
      }

      const oldId = team.defense[action.slot];
      if (!oldId) return state;

      const blowout = isBlowout(state.situation);
      const warnings = validateDefensiveSubstitution(
        team,
        oldId,
        action.playerId,
        team.removedFromGame,
        blowout
      );
      if (hasBlockingWarning(warnings)) return state;

      const order = [...team.battingOrder];
      const lineupIdx = order.indexOf(oldId);
      if (lineupIdx >= 0) order[lineupIdx] = action.playerId;

      let bench = team.bench.filter((id) => id !== action.playerId);
      const removed = team.removedFromGame.includes(oldId)
        ? team.removedFromGame
        : [...team.removedFromGame, oldId];

      let defense = stripPlayerFromDefense(team.defense, action.playerId);
      defense = { ...defense, [action.slot]: action.playerId };

      const runners = { ...state.situation.runners };
      for (const base of ["first", "second", "third"] as const) {
        if (runners[base] === oldId) delete runners[base];
      }

      let situation = { ...state.situation, runners };
      if (situation.batterId === oldId) situation = { ...situation, batterId: action.playerId };

      return clearPreview({
        ...state,
        teams: {
          ...state.teams,
          [action.side]: { ...team, battingOrder: order, defense, bench, removedFromGame: removed },
        },
        situation,
      });
    }
    case "APPLY_PLAY":
      return clearPreview({
        ...state,
        situation: action.situation,
      });
    case "PATCH_CHALLENGES":
      return clearPreview({
        ...state,
        situation: {
          ...state.situation,
          homeChallengesRemaining: action.home,
          awayChallengesRemaining: action.away,
        },
      });
    case "RESET_TO_FORK": {
      const snap = state.forkSnapshot;
      if (!snap) return state;
      return clearPreview({
        ...state,
        situation: structuredClone(snap.situation),
        teams: structuredClone(snap.teams),
        checkpoint: structuredClone(snap.checkpoint),
        playerNames: { ...snap.playerNames },
      });
    }
    case "SET_PREVIEW_GRID":
      return {
        ...state,
        previewGrid: action.grid,
        previewGridComputedAt: action.computedAt,
      };
    default:
      return state;
  }
}

export function playerLabel(names: Record<number, string>, id: number): string {
  return names[id] ?? `Player ${id}`;
}

export function sideForTeam(doc: BranchDocument, teamId: number): BranchSide {
  return teamId === doc.schedule.homeTeamId ? "home" : "away";
}

export function validateBranchImport(body: unknown): body is BranchDocument {
  if (!body || typeof body !== "object") return false;
  const doc = body as BranchDocument;
  return (
    doc.schemaVersion === BRANCH_SCHEMA_VERSION &&
    typeof doc.parentGamePk === "number" &&
    doc.situation != null &&
    doc.teams != null
  );
}
