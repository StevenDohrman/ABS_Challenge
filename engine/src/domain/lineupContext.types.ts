/**
 * Baserunning context inputs — resolved by the backend before calling the engine.
 */
export interface BaserunningContextInput {
  runnerIds: {
    first?: number;
    second?: number;
    third?: number;
  };
  batterSprintSpeed: number | null;
  runnerSprintSpeeds: {
    first?: number;
    second?: number;
    third?: number;
  };
}

/**
 * Upcoming batter in the due-up window with pre-resolved offensive stats.
 */
export interface DueUpBatter {
  playerId: number;
  ops: number | null;
  woba: number | null;
}

export interface LineupContextInput {
  /** Decay-weighted window of batters due up this half-inning (excludes current batter). */
  dueUpBatters: DueUpBatter[];
}
