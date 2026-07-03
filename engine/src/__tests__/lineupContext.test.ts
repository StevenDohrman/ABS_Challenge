import {
  computeLineupContext,
  buildDueUpWindow,
} from "../features/lineupContext";
import { LineupContextInput } from "../domain/lineupContext.types";
import { defaultLeague } from "./fixtures/league";

const ORDER = [100, 101, 102, 103, 104, 105, 106, 107, 108];
const league = defaultLeague;

describe("buildDueUpWindow", () => {
  it("returns on-deck plus next batters sized by outs remaining", () => {
    expect(buildDueUpWindow(ORDER, 100, 2)).toEqual([101, 102, 103]);
    expect(buildDueUpWindow(ORDER, 100, 0)).toEqual([101, 102, 103, 104, 105]);
  });

  it("returns empty when batter is not in the order", () => {
    expect(buildDueUpWindow(ORDER, 999, 1)).toEqual([]);
  });
});

describe("computeLineupContext", () => {
  it("returns 1.0× when lineup data is missing", () => {
    expect(computeLineupContext(undefined, league).multiplier).toBe(1);
  });

  it("boosts multiplier for strong upcoming hitters", () => {
    const lineup: LineupContextInput = {
      dueUpBatters: [
        { playerId: 101, ops: 0.950, woba: 0.400 },
        { playerId: 102, ops: 0.920, woba: 0.390 },
      ],
    };
    const result = computeLineupContext(lineup, league);
    expect(result.multiplier).toBeGreaterThan(1);
    expect(result.strongUpcoming).toBe(true);
  });

  it("reduces multiplier for weak upcoming hitters", () => {
    const lineup: LineupContextInput = {
      dueUpBatters: [
        { playerId: 101, ops: 0.550, woba: 0.260 },
        { playerId: 102, ops: 0.520, woba: 0.250 },
      ],
    };
    const result = computeLineupContext(lineup, league);
    expect(result.multiplier).toBeLessThan(1);
  });
});
