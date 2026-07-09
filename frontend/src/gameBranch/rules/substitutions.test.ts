import { describe, it, expect } from "vitest";
import {
  isBlowout,
  validatePinchHit,
  validatePitcherChange,
  listReplacementOptions,
  hasBlockingWarning,
} from "./substitutions";
import type { TeamBranchState } from "../state/branchTypes";

const team: TeamBranchState = {
  teamId: 1,
  battingOrder: [1, 2, 3],
  bench: [10, 11],
  bullpen: [20, 21],
  defense: { pitcher: 20 },
  removedFromGame: [99],
};

describe("isBlowout", () => {
  it("detects 9+ run lead after 5th inning", () => {
    expect(
      isBlowout({
        inning: 5,
        halfInning: "top",
        homeScore: 10,
        awayScore: 1,
      } as never)
    ).toBe(true);
  });
});

describe("validatePinchHit", () => {
  it("blocks bench players who already left the game", () => {
    const warnings = validatePinchHit(team, 1, 99, team.removedFromGame, false);
    expect(hasBlockingWarning(warnings)).toBe(true);
  });

  it("blocks bullpen arms used as pinch hitters", () => {
    const warnings = validatePinchHit(team, 1, 21, team.removedFromGame, false);
    expect(hasBlockingWarning(warnings)).toBe(true);
  });
});

describe("listReplacementOptions", () => {
  it("lists bench options for lineup selection", () => {
    const options = listReplacementOptions(
      team,
      { kind: "lineup", slotIndex: 0, playerId: 1 },
      false
    );
    expect(options.map((o) => o.playerId)).toEqual([10, 11]);
    expect(options.every((o) => o.source === "bench")).toBe(true);
  });

  it("lists bullpen for pitcher defense selection", () => {
    const options = listReplacementOptions(
      team,
      { kind: "defense", slot: "pitcher", playerId: 20 },
      false
    );
    expect(options.map((o) => o.playerId)).toEqual([21]);
    expect(options[0]?.source).toBe("bullpen");
  });

  it("lists bench only for fielding substitutions", () => {
    const options = listReplacementOptions(
      team,
      { kind: "defense", slot: "center", playerId: 1 },
      false
    );
    expect(options.every((o) => o.source === "bench")).toBe(true);
  });
});

describe("validatePitcherChange", () => {
  it("requires bullpen unless blowout", () => {
    const warnings = validatePitcherChange(team, 10, team.removedFromGame, false);
    expect(hasBlockingWarning(warnings)).toBe(true);
  });

  it("allows bullpen arms", () => {
    const warnings = validatePitcherChange(team, 21, team.removedFromGame, false);
    expect(hasBlockingWarning(warnings)).toBe(false);
  });
});
