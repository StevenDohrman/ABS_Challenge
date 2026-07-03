import { computeBaserunningContext } from "../features/baserunningContext";
import { BaserunningContextInput } from "../domain/baserunningContext.types";
import { BASEBALL_RULES } from "../constants";
import { makeGameState as baseGameState } from "./fixtures/gameState";

function makeGameState(overrides: Parameters<typeof baseGameState>[0] = {}) {
  return baseGameState({
    balls: 3,
    strikes: 1,
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  });
}

function makeBaserunning(
  overrides: Partial<BaserunningContextInput> = {}
): BaserunningContextInput {
  return {
    runnerIds: {},
    batterSprintSpeed: 27,
    runnerSprintSpeeds: {},
    ...overrides,
  };
}

describe("computeBaserunningContext", () => {
  it("returns 1.0× on non-walk counts regardless of speed", () => {
    const result = computeBaserunningContext(
      makeGameState({ balls: 2, runnerOnFirst: true }),
      makeBaserunning({
        runnerSprintSpeeds: { first: 30 },
      })
    );
    expect(result.multiplier).toBe(1);
    expect(result.walkPath).toBe(false);
  });

  it("uses batter speed on empty-base walk counts", () => {
    const fast = computeBaserunningContext(
      makeGameState({ balls: BASEBALL_RULES.BALLS_FOR_WALK }),
      makeBaserunning({ batterSprintSpeed: 30 })
    );
    const slow = computeBaserunningContext(
      makeGameState({ balls: BASEBALL_RULES.BALLS_FOR_WALK }),
      makeBaserunning({ batterSprintSpeed: 24 })
    );
    expect(fast.multiplier).toBeGreaterThan(1);
    expect(slow.multiplier).toBeLessThan(1);
  });

  it("bottlenecks R1 speed when slow R2 is the lead runner", () => {
    const slowLead = computeBaserunningContext(
      makeGameState({
        balls: 3,
        runnerOnFirst: true,
        runnerOnSecond: true,
      }),
      makeBaserunning({
        batterSprintSpeed: 30,
        runnerSprintSpeeds: { first: 30, second: 24 },
      })
    );
    const fastLead = computeBaserunningContext(
      makeGameState({
        balls: 3,
        runnerOnFirst: true,
        runnerOnSecond: true,
      }),
      makeBaserunning({
        batterSprintSpeed: 30,
        runnerSprintSpeeds: { first: 24, second: 30 },
      })
    );
    expect(fastLead.multiplier).toBeGreaterThan(slowLead.multiplier);
  });

  it("caps value on bases-loaded walk by slow R3", () => {
    const slowR3 = computeBaserunningContext(
      makeGameState({
        balls: 3,
        runnerOnFirst: true,
        runnerOnSecond: true,
        runnerOnThird: true,
      }),
      makeBaserunning({
        batterSprintSpeed: 30,
        runnerSprintSpeeds: { first: 30, second: 30, third: 20 },
      })
    );
    expect(slowR3.multiplier).toBeLessThan(1);
    expect(slowR3.note).toBe("slow_lead");
  });

  it("returns 1.0× when no speed data is available", () => {
    const result = computeBaserunningContext(
      makeGameState({ balls: 3, runnerOnFirst: true }),
      makeBaserunning({
        batterSprintSpeed: null,
        runnerSprintSpeeds: { first: undefined },
      })
    );
    expect(result.multiplier).toBe(1);
    expect(result.dataAvailable).toBe(false);
  });
});
