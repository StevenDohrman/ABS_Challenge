/**
 * Fielder IDs for the current defensive alignment, extracted from
 * linescore.defense in the MLB live feed. All slots are optional because
 * the API may omit them in early-game states or for historical backfill plays.
 *
 * Position keys match the fielder_oaa table position abbreviations after
 * conversion: first→1B, second→2B, third→3B, shortstop→SS, left→LF,
 * center→CF, right→RF.
 */
export interface DefensiveLineup {
  pitcher?: number;
  catcher?: number;
  first?: number;     // 1B
  second?: number;    // 2B
  third?: number;     // 3B
  shortstop?: number; // SS
  left?: number;      // LF
  center?: number;    // CF
  right?: number;     // RF
}

/** Runner IDs occupying each base at at-bat start. */
export interface BaseRunners {
  first?: number;
  second?: number;
  third?: number;
}

/** One row in game_lineups — batting order slot for a player. */
export interface GameLineupEntry {
  gamePk: number;
  teamId: number;
  playerId: number;
  /** 1-based spot in the order. */
  battingOrder: number;
  fetchedAt: string;
}

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

  /** True when an ABS challenge review was triggered on this pitch. */
  hasReview: boolean;
  /** Whether the challenge overturned the original call. Null when no review or still in progress. */
  isOverturned: boolean | null;
  /** Full name of the player associated with the challenge (batter or catcher). */
  challengerName: string | null;
  /** Team ID of the team that issued the challenge. Compare to battingTeamId/fieldingTeamId to determine side. */
  challengerTeamId: number | null;

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

  /** MLB player IDs on each occupied base. Live at-bats only. */
  runnerIds?: BaseRunners;

  homeScore: number;
  awayScore: number;

  battingTeamId: number;
  fieldingTeamId: number;

  /**
   * Defensive fielder IDs for the current alignment, extracted from
   * linescore.defense in the MLB live feed. Absent for historical backfill
   * at-bats (live feed doesn't carry per-play defense history).
   */
  defense?: DefensiveLineup;

  /**
   * Batting order for the batting team (player IDs, 1st through 9th).
   * Parsed from liveData.boxscore.teams.{home|away}.battingOrder.
   */
  battingOrder?: number[];

  fetchedAt: string;
}

/** MLB pitch call code for a called strike (no swing). */
export const CALLED_STRIKE_CALL_CODE = "C";

/**
 * First-poll batch of completed at-bats plus which indices need pre-compute
 * before historical pitch replay (only at-bats with called strikes).
 */
export interface GameBackfillPayload {
  snapshots: MlbAtBatSnapshot[];
  calledStrikeAtBatIndices: number[];
}
