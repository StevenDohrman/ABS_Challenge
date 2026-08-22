import type { BranchDocument, BranchRunners, BranchSituation } from "../state/branchTypes";
import {
  OUTS_PER_HALF_INNING,
  endHalfInning,
  nextBatterId,
} from "./inningProgression";

export type PlayType =
  | "single"
  | "double"
  | "home_run"
  | "walk"
  | "strikeout"
  | "out"
  | "sac_fly"
  | "double_play";

export interface PlayResult {
  situation: BranchSituation;
  description: string;
}

const ALWAYS_AVAILABLE: PlayType[] = [
  "walk",
  "single",
  "double",
  "home_run",
  "strikeout",
  "out",
];

function runnerCount(runners: BranchRunners): number {
  return [runners.first, runners.second, runners.third].filter((id) => id != null).length;
}

/** Sac fly: runner on 3rd and fewer than 2 outs. DP: ≥1 runner and fewer than 2 outs. */
export function playIsAvailable(sit: BranchSituation, play: PlayType): boolean {
  switch (play) {
    case "sac_fly":
      return sit.runners.third != null && sit.outs < 2;
    case "double_play":
      return runnerCount(sit.runners) >= 1 && sit.outs < 2;
    default:
      return true;
  }
}

export function availablePlays(sit: BranchSituation): PlayType[] {
  const situational: PlayType[] = [];
  if (playIsAvailable(sit, "sac_fly")) situational.push("sac_fly");
  if (playIsAvailable(sit, "double_play")) situational.push("double_play");
  return [...ALWAYS_AVAILABLE, ...situational];
}

function clearCount(sit: BranchSituation): BranchSituation {
  return { ...sit, balls: 0, strikes: 0 };
}

function battingOrderFor(doc: BranchDocument, sit: BranchSituation): number[] {
  const side = sit.battingTeamId === doc.schedule.homeTeamId ? "home" : "away";
  return doc.teams[side].battingOrder;
}

function applyRuns(sit: BranchSituation, runs: number): BranchSituation {
  if (runs <= 0) return sit;
  if (sit.halfInning === "top") {
    return { ...sit, awayScore: sit.awayScore + runs };
  }
  return { ...sit, homeScore: sit.homeScore + runs };
}

function afterPlateAppearance(
  doc: BranchDocument,
  sit: BranchSituation,
  patch: Partial<BranchSituation>
): BranchSituation {
  const merged = { ...clearCount(sit), ...patch };
  const order = battingOrderFor(doc, merged);
  return { ...merged, batterId: nextBatterId(order, sit.batterId) };
}

function afterOuts(
  doc: BranchDocument,
  sit: BranchSituation,
  keepRunners: BranchRunners,
  outCount: 1 | 2,
  labels: { recorded: string; inningOver: string }
): PlayResult {
  const outs = sit.outs + outCount;
  const cleared = { ...clearCount(sit), outs, runners: keepRunners };
  if (outs >= OUTS_PER_HALF_INNING) {
    return {
      situation: endHalfInning(doc, cleared),
      description: labels.inningOver,
    };
  }
  const order = battingOrderFor(doc, sit);
  return {
    situation: {
      ...cleared,
      batterId: nextBatterId(order, sit.batterId),
    },
    description: labels.recorded,
  };
}

const BASE_DEST = { 1: "first", 2: "second", 3: "third" } as const;

/** Station-to-station: everyone including the batter advances `batterBases`. */
function advanceByBases(
  runners: BranchRunners,
  batterId: number,
  batterBases: 1 | 2 | 4
): { runners: BranchRunners; runs: number } {
  const movers: Array<{ id: number; dest: number }> = [];
  if (runners.third != null) movers.push({ id: runners.third, dest: 3 + batterBases });
  if (runners.second != null) movers.push({ id: runners.second, dest: 2 + batterBases });
  if (runners.first != null) movers.push({ id: runners.first, dest: 1 + batterBases });
  movers.push({ id: batterId, dest: batterBases });

  let runs = 0;
  const next: BranchRunners = {};
  for (const mover of movers) {
    if (mover.dest >= 4) {
      runs += 1;
      continue;
    }
    next[BASE_DEST[mover.dest as 1 | 2 | 3]] = mover.id;
  }
  return { runners: next, runs };
}

/**
 * Walk force only: a runner advances if every base behind them is occupied.
 * Bases-loaded walk scores the runner on third.
 */
function advanceWalk(
  runners: BranchRunners,
  batterId: number
): { runners: BranchRunners; runs: number } {
  const first = runners.first;
  const second = runners.second;
  const third = runners.third;
  const forceSecond = first != null;
  const forceThird = first != null && second != null;
  const forceHome = first != null && second != null && third != null;

  const next: BranchRunners = {};
  let runs = 0;

  if (forceHome) {
    runs = 1;
  } else if (third != null) {
    next.third = third;
  }

  if (forceThird && second != null) {
    next.third = second;
  } else if (second != null && !forceSecond) {
    next.second = second;
  }

  if (forceSecond && first != null) {
    next.second = first;
  }

  next.first = batterId;
  return { runners: next, runs };
}

function applyHit(
  doc: BranchDocument,
  sit: BranchSituation,
  batterBases: 1 | 2 | 4,
  description: string
): PlayResult {
  const { runners, runs } = advanceByBases(sit.runners, sit.batterId, batterBases);
  const scored = applyRuns(sit, runs);
  return {
    situation: afterPlateAppearance(doc, scored, {
      runners,
      homeScore: scored.homeScore,
      awayScore: scored.awayScore,
    }),
    description,
  };
}

/** Classic GIDP: runner on first is out if present; otherwise the lead runner. */
function removeDoublePlayRunner(runners: BranchRunners): BranchRunners {
  const next = { ...runners };
  if (next.first != null) {
    delete next.first;
    return next;
  }
  if (next.third != null) {
    delete next.third;
    return next;
  }
  delete next.second;
  return next;
}

export function applyPlay(
  doc: BranchDocument,
  sit: BranchSituation,
  play: PlayType,
  manualRunners?: BranchRunners
): PlayResult {
  if (manualRunners) {
    return {
      situation: { ...clearCount(sit), runners: manualRunners },
      description: "Manual runner placement",
    };
  }

  if (!playIsAvailable(sit, play)) {
    return { situation: sit, description: "" };
  }

  switch (play) {
    case "walk": {
      const { runners, runs } = advanceWalk(sit.runners, sit.batterId);
      const scored = applyRuns(sit, runs);
      return {
        situation: afterPlateAppearance(doc, scored, {
          runners,
          homeScore: scored.homeScore,
          awayScore: scored.awayScore,
        }),
        description: runs > 0 ? "Walk — run scores" : "Walk — forced advance",
      };
    }
    case "single":
      return applyHit(doc, sit, 1, "Single — station to station");
    case "double":
      return applyHit(doc, sit, 2, "Double — two bases");
    case "home_run":
      return applyHit(doc, sit, 4, "Home run");
    case "strikeout":
      return afterOuts(doc, sit, sit.runners, 1, {
        recorded: "Strikeout",
        inningOver: "Strikeout — third out, half inning over",
      });
    case "out":
      return afterOuts(doc, sit, sit.runners, 1, {
        recorded: "In-play out",
        inningOver: "In-play out — third out, half inning over",
      });
    case "sac_fly": {
      const runners = { ...sit.runners };
      delete runners.third;
      const scored = applyRuns(sit, 1);
      return afterOuts(doc, scored, runners, 1, {
        recorded: "Sacrifice fly",
        inningOver: "Sacrifice fly — third out, half inning over",
      });
    }
    case "double_play":
      return afterOuts(doc, sit, removeDoublePlayRunner(sit.runners), 2, {
        recorded: "Double play",
        inningOver: "Double play — third out, half inning over",
      });
    default:
      return { situation: sit, description: "" };
  }
}
