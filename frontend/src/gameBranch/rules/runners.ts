import type { BranchDocument, BranchRunners, BranchSituation } from "../state/branchTypes";
import { OUTS_PER_HALF_INNING, endHalfInning } from "./inningProgression";

const BASES: (keyof BranchRunners)[] = ["first", "second", "third"];
const NEXT_BASE: Record<Exclude<keyof BranchRunners, "third">, keyof BranchRunners> = {
  first: "second",
  second: "third",
};

function applyRuns(sit: BranchSituation, runs: number): BranchSituation {
  if (runs <= 0) return sit;
  if (sit.halfInning === "top") {
    return { ...sit, awayScore: sit.awayScore + runs };
  }
  return { ...sit, homeScore: sit.homeScore + runs };
}

/**
 * Advance one runner a base. Occupied destinations push the lead runner first
 * (third scores). Count and batter stay put — this is not a plate appearance.
 */
export function advanceRunner(
  sit: BranchSituation,
  base: keyof BranchRunners
): { situation: BranchSituation; description: string } | null {
  if (sit.runners[base] == null) return null;

  const runners = { ...sit.runners };

  function push(from: keyof BranchRunners): number {
    const id = runners[from];
    if (id == null) return 0;
    if (from === "third") {
      delete runners.third;
      return 1;
    }
    const next = NEXT_BASE[from];
    const scored = runners[next] != null ? push(next) : 0;
    runners[next] = id;
    delete runners[from];
    return scored;
  }

  const runs = push(base);
  return {
    situation: { ...applyRuns(sit, runs), runners },
    description: runs > 0 ? "Runner scores" : "Runner advanced",
  };
}

/** Retire one runner. Third out ends the half-inning; count/batter unchanged otherwise. */
export function retireRunner(
  doc: BranchDocument,
  sit: BranchSituation,
  base: keyof BranchRunners
): { situation: BranchSituation; description: string } | null {
  if (sit.runners[base] == null) return null;

  const runners = { ...sit.runners };
  delete runners[base];
  const outs = sit.outs + 1;
  const next = { ...sit, outs, runners };

  if (outs >= OUTS_PER_HALF_INNING) {
    return {
      situation: endHalfInning(doc, next),
      description: "Runner out — half inning over",
    };
  }
  return { situation: next, description: "Runner out" };
}

/** No duplicate runner IDs; max three occupied bases. */
export function validateRunners(runners: BranchRunners): string[] {
  const warnings: string[] = [];
  const ids = BASES.map((b) => runners[b]).filter((id): id is number => id != null);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    warnings.push("A runner cannot occupy two bases at once.");
  }
  if (ids.length > 3) {
    warnings.push("At most three runners allowed on base.");
  }
  return warnings;
}

export function clampCount(value: number, max: number): number {
  return Math.min(Math.max(0, value), max);
}
