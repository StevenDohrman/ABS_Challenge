import type { BranchDocument, BranchRunners, BranchSituation } from "../state/branchTypes";
import {
  OUTS_PER_HALF_INNING,
  endHalfInning,
  nextBatterId,
} from "./inningProgression";

export type PlayType = "single" | "walk" | "strikeout" | "sac_fly";

export interface PlayResult {
  situation: BranchSituation;
  description: string;
}

function advanceForce(runners: BranchRunners, batterId: number): BranchRunners {
  const next: BranchRunners = {};
  if (runners.first != null) next.second = runners.first;
  if (runners.second != null) next.third = runners.second;
  next.first = batterId;
  return next;
}

function clearCount(sit: BranchSituation): BranchSituation {
  return { ...sit, balls: 0, strikes: 0 };
}

function battingOrderFor(doc: BranchDocument, sit: BranchSituation): number[] {
  const side = sit.battingTeamId === doc.schedule.homeTeamId ? "home" : "away";
  return doc.teams[side].battingOrder;
}

function afterPlateAppearance(
  doc: BranchDocument,
  sit: BranchSituation,
  patch: Partial<BranchSituation>
): BranchSituation {
  const merged = { ...sit, ...patch };
  const order = battingOrderFor(doc, merged);
  return { ...merged, batterId: nextBatterId(order, sit.batterId) };
}

function afterOut(
  doc: BranchDocument,
  sit: BranchSituation,
  keepRunners: BranchRunners
): { situation: BranchSituation; description: string } {
  const outs = sit.outs + 1;
  if (outs >= OUTS_PER_HALF_INNING) {
    const ended = endHalfInning(doc, { ...clearCount(sit), outs, runners: keepRunners });
    return {
      situation: ended,
      description: "Third out — half inning over",
    };
  }
  const order = battingOrderFor(doc, sit);
  return {
    situation: {
      ...clearCount(sit),
      outs,
      runners: keepRunners,
      batterId: nextBatterId(order, sit.batterId),
    },
    description: "Out recorded",
  };
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

  switch (play) {
    case "walk":
      return {
        situation: afterPlateAppearance(doc, sit, {
          runners: advanceForce(sit.runners, sit.batterId),
        }),
        description: "Walk — forced advance",
      };
    case "single":
      return {
        situation: afterPlateAppearance(doc, sit, {
          runners: advanceForce(sit.runners, sit.batterId),
        }),
        description: "Single — batter to first, forced runners advance one base",
      };
    case "strikeout": {
      const result = afterOut(doc, sit, sit.runners);
      return { situation: result.situation, description: result.description };
    }
    case "sac_fly": {
      const runners = { ...sit.runners };
      let homeScore = sit.homeScore;
      let awayScore = sit.awayScore;
      if (runners.third != null) {
        delete runners.third;
        if (sit.halfInning === "top") awayScore += 1;
        else homeScore += 1;
      }
      const result = afterOut(doc, { ...sit, homeScore, awayScore }, runners);
      return { situation: result.situation, description: "Sacrifice fly" };
    }
    default:
      return { situation: sit, description: "" };
  }
}
