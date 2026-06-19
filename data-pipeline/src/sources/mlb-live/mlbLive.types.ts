/**
 * balls/strikes/outs represent the count AFTER the pitch (from playEvent.count).
 * ballsBefore/strikesBefore represent the count BEFORE the pitch, computed during
 * parsing by walking the play's event sequence. These pre-pitch values are the
 * lookup key the backend uses to find a pre-computed recommendation for that count.
 */
export interface MlbLivePitchEvent {
  gamePk: number;
  playId?: string;
  atBatIndex: number;
  pitchNumber: number;

  inning: number;
  halfInning: "top" | "bottom";

  ballsBefore: number;
  strikesBefore: number;

  balls: number;
  strikes: number;
  /** Outs in the inning at the time of this pitch. Does not change within a single at-bat. */
  outs: number;

  batterId: number;
  pitcherId: number;

  callCode?: string;
  callDescription?: string;

  raw: unknown;
  fetchedAt: string;
}

/** Current game state captured on each poll cycle, derived from the linescore. */
export interface MlbLiveGameSnapshot {
  gamePk: number;
  inning: number;
  halfInning: "top" | "bottom";
  detailedState: string;

  outs: number;
  balls: number;
  strikes: number;

  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;

  homeScore: number;
  awayScore: number;
  homeTeamId: number;
  awayTeamId: number;

  batterId?: number;
  pitcherId?: number;

  fetchedAt: string;
}

/**
 * Emitted by the poller when the at-bat index advances (new batter up).
 * The backend uses this as the trigger to pre-compute recommendations
 * for all 12 possible count states for this matchup.
 */
export interface MlbAtBatSnapshot {
  gamePk: number;
  atBatIndex: number;

  batterId: number;
  pitcherId: number;

  inning: number;
  halfInning: "top" | "bottom";
  outs: number;

  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;

  homeScore: number;
  awayScore: number;

  battingTeamId: number;
  fieldingTeamId: number;

  fetchedAt: string;
}
