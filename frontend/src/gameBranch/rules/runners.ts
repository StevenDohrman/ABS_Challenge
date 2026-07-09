import type { BranchRunners } from "../state/branchTypes";

const BASES: (keyof BranchRunners)[] = ["first", "second", "third"];

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
