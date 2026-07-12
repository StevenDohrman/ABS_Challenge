import type { BranchSituation, DefensiveLineup, TeamBranchState } from "../state/branchTypes";

export interface SubWarning {
  level: "warn" | "block";
  message: string;
}

/** MLB-style blowout re-entry window (simplified). */
export function isBlowout(sit: BranchSituation): boolean {
  const lead = Math.abs(sit.homeScore - sit.awayScore);
  if (lead >= 10) return true;
  return sit.inning >= 5 && lead >= 9;
}

/** Pinch hitter — bench player replaces a lineup slot (offense only). */
export function validatePinchHit(
  team: TeamBranchState,
  replacedId: number,
  incomingId: number,
  removedFromGame: number[],
  blowout: boolean
): SubWarning[] {
  if (!team.bench.includes(incomingId)) {
    return [{ level: "block", message: "Pinch hitters must come from the bench." }];
  }
  if (team.battingOrder.includes(incomingId)) {
    return [{ level: "block", message: "Player is already in the lineup." }];
  }
  if (removedFromGame.includes(replacedId)) {
    return [{ level: "block", message: "That player is already out of the game." }];
  }
  if (removedFromGame.includes(incomingId)) {
    if (!blowout) {
      return [{
        level: "block",
        message: "Removed players cannot re-enter unless the game is a blowout.",
      }];
    }
    return [{
      level: "warn",
      message: "Re-entering a removed player — allowed in a blowout.",
    }];
  }
  return [];
}

/**
 * Defensive replacement — bench player takes the field AND the replaced
 * player's spot in the batting order (standard MLB defensive sub).
 */
export function validateDefensiveSubstitution(
  team: TeamBranchState,
  outgoingId: number,
  incomingId: number,
  removedFromGame: number[],
  blowout: boolean
): SubWarning[] {
  if (!team.bench.includes(incomingId)) {
    return [{ level: "block", message: "Defensive replacements must come from the bench." }];
  }
  if (removedFromGame.includes(outgoingId)) {
    return [{ level: "block", message: "That player is already out of the game." }];
  }
  if (removedFromGame.includes(incomingId)) {
    if (!blowout) {
      return [{
        level: "block",
        message: "Removed players cannot re-enter unless the game is a blowout.",
      }];
    }
    return [{
      level: "warn",
      message: "Re-entering a removed player — allowed in a blowout.",
    }];
  }
  return [];
}

export function validatePitcherChange(
  team: TeamBranchState,
  newPitcherId: number,
  removedFromGame: number[],
  blowout: boolean
): SubWarning[] {
  if (removedFromGame.includes(newPitcherId)) {
    if (!blowout) {
      return [{
        level: "block",
        message: "That pitcher already appeared and cannot re-enter unless the game is a blowout.",
      }];
    }
    return [{
      level: "warn",
      message: "Re-entering a removed pitcher — allowed in a blowout.",
    }];
  }

  if (team.bullpen.includes(newPitcherId)) {
    return [];
  }

  if (!blowout) {
    return [{
      level: "block",
      message: "Pitcher changes must come from the bullpen.",
    }];
  }

  const positionPlayer =
    team.bench.includes(newPitcherId) || team.battingOrder.includes(newPitcherId);
  if (!positionPlayer) {
    return [{
      level: "block",
      message: "Pitcher must come from the bullpen, or a position player in a blowout.",
    }];
  }

  return [{
    level: "warn",
    message: "Position player pitching — allowed in a blowout.",
  }];
}

export function hasBlockingWarning(warnings: SubWarning[]): boolean {
  return warnings.some((w) => w.level === "block");
}

export type SubSelection =
  | { kind: "lineup"; slotIndex: number; playerId: number }
  | { kind: "defense"; slot: keyof DefensiveLineup; playerId: number };

export interface ReplacementOption {
  playerId: number;
  source: "bench" | "bullpen" | "lineup";
  disabled: boolean;
  reason?: string;
}

const DEFENSE_SLOT_LABELS: Record<keyof DefensiveLineup, string> = {
  pitcher: "P",
  catcher: "C",
  first: "1B",
  second: "2B",
  shortstop: "SS",
  third: "3B",
  left: "LF",
  center: "CF",
  right: "RF",
};

export function selectionLabel(selection: SubSelection): string {
  if (selection.kind === "lineup") {
    return `lineup #${selection.slotIndex + 1}`;
  }
  return DEFENSE_SLOT_LABELS[selection.slot];
}

export function listReplacementOptions(
  team: TeamBranchState,
  selection: SubSelection,
  blowout: boolean
): ReplacementOption[] {
  if (selection.kind === "lineup") {
    const replaced = team.battingOrder[selection.slotIndex];
    if (!replaced) return [];
    return team.bench.map((playerId) => {
      const warnings = validatePinchHit(team, replaced, playerId, team.removedFromGame, blowout);
      const block = warnings.find((w) => w.level === "block");
      return {
        playerId,
        source: "bench" as const,
        disabled: !!block,
        reason: block?.message,
      };
    });
  }

  if (selection.slot === "pitcher") {
    const candidateIds = new Set<number>(team.bullpen);
    if (blowout) {
      for (const id of team.bench) candidateIds.add(id);
      for (const id of team.battingOrder) candidateIds.add(id);
    }
    candidateIds.delete(selection.playerId);

    return [...candidateIds].map((playerId) => {
      const warnings = validatePitcherChange(team, playerId, team.removedFromGame, blowout);
      const block = warnings.find((w) => w.level === "block");
      const source: ReplacementOption["source"] = team.bullpen.includes(playerId)
        ? "bullpen"
        : team.bench.includes(playerId)
          ? "bench"
          : "lineup";
      return {
        playerId,
        source,
        disabled: !!block,
        reason: block?.message,
      };
    });
  }

  return team.bench.map((playerId) => {
    const warnings = validateDefensiveSubstitution(
      team,
      selection.playerId,
      playerId,
      team.removedFromGame,
      blowout
    );
    const block = warnings.find((w) => w.level === "block");
    return {
      playerId,
      source: "bench" as const,
      disabled: !!block,
      reason: block?.message,
    };
  });
}
