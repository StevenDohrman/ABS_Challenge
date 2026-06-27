/**
 * Raw response shapes from the MLB Stats API.
 * https://statsapi.mlb.com/api
 *
 * These types reflect what the API actually returns and should NOT be used
 * outside of the data-pipeline. Convert to internal domain types before
 * passing data anywhere else.
 */

// ---------------------------------------------------------------------------
// Schedule  GET /v1/schedule?sportId=1&date=YYYY-MM-DD
// ---------------------------------------------------------------------------

export type MlbAbstractGameState = "Preview" | "Live" | "Final";

export type MlbDetailedState =
  | "Scheduled"
  | "Pre-Game"
  | "Warmup"
  | "In Progress"
  | "Manager challenge"
  | "Delayed"
  | "Suspended"
  | "Final"
  | "Game Over"
  | "Postponed"
  | "Cancelled";

export interface MlbGameStatus {
  abstractGameState: MlbAbstractGameState;
  detailedState: MlbDetailedState;
  /** True when the game is currently being played (abstractGameState === "Live") */
  abstractGameCode: "P" | "L" | "F";
  statusCode: string;
}

export interface MlbTeamRef {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface MlbScheduleTeamEntry {
  team: MlbTeamRef;
  score?: number;
  isWinner?: boolean;
}

export interface MlbScheduleGame {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  status: MlbGameStatus;
  teams: {
    home: MlbScheduleTeamEntry;
    away: MlbScheduleTeamEntry;
  };
  venue?: { id: number; name: string };
  doubleHeader: "N" | "Y" | "S";
  gameNumber: number;
}

export interface MlbScheduleDate {
  date: string;
  games: MlbScheduleGame[];
}

export interface MlbScheduleResponse {
  totalGames: number;
  totalGamesInProgress: number;
  dates: MlbScheduleDate[];
}

// ---------------------------------------------------------------------------
// Live Feed  GET /v1.1/game/{gamePk}/feed/live
// ---------------------------------------------------------------------------

export interface MlbLivePlayer {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation: string };
  batSide?: { code: "L" | "R" | "S" };
  pitchHand?: { code: "L" | "R" };
}

export interface MlbLiveTeam {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface MlbLiveGameData {
  game: {
    pk: number;
    type: string;
    doubleHeader: string;
    gameNumber: number;
  };
  datetime: {
    dateTime: string;
    officialDate: string;
  };
  status: MlbGameStatus;
  teams: {
    home: { team: MlbLiveTeam };
    away: { team: MlbLiveTeam };
  };
  players: Record<string, MlbLivePlayer>;
}

export interface MlbCount {
  balls: number;
  strikes: number;
  outs: number;
}

export interface MlbPitchDetails {
  call: {
    code: string;
    description: string;
  };
  type: {
    code: string;
    description: string;
  };
  /** True when this pitch triggered a manager/batter review. */
  hasReview?: boolean;
}

export interface MlbReviewDetails {
  isOverturned: boolean;
  inProgress: boolean;
  reviewType: string;
  /** The team that initiated the challenge. */
  challengeTeamId: number;
  /** The player most associated with the challenge (batter or catcher). */
  player: { id: number; fullName: string; link: string };
}

export interface MlbPlayEvent {
  details: MlbPitchDetails;
  count: MlbCount;
  pitchNumber: number;
  index: number;
  isPitch: boolean;
  type: "pitch" | "action" | "no_pitch" | "pickoff";
  playId?: string;
  /** Populated when this pitch triggered an ABS challenge review. */
  reviewDetails?: MlbReviewDetails;
}

export interface MlbMatchup {
  batter: { id: number; fullName: string };
  pitcher: { id: number; fullName: string };
  batSide: { code: "L" | "R" | "S" };
  pitchHand: { code: "L" | "R" };
}

export interface MlbAboutPlay {
  atBatIndex: number;
  halfInning: "top" | "bottom";
  isTopInning: boolean;
  inning: number;
  startTime: string;
  endTime?: string;
  isComplete: boolean;
}

export interface MlbPlay {
  result: {
    type: string;
    event: string;
    eventType: string;
    description: string;
  };
  about: MlbAboutPlay;
  count: MlbCount;
  matchup: MlbMatchup;
  playEvents: MlbPlayEvent[];
  atBatIndex: number;
  playId?: string;
}

export interface MlbRunnerMovement {
  originBase: string | null;
  start: string | null;
  end: string | null;
  outBase: string | null;
  isOut: boolean;
  outNumber: number | null;
}

export interface MlbLinescore {
  currentInning?: number;
  currentInningOrdinal?: string;
  inningHalf?: "Top" | "Bottom";
  isTopInning?: boolean;
  scheduledInnings: number;
  outs: number;
  balls: number;
  strikes: number;
  teams: {
    home: { runs: number; hits: number; errors: number };
    away: { runs: number; hits: number; errors: number };
  };
  offense: {
    batter?: { id: number; fullName: string };
    pitcher?: { id: number; fullName: string };
    first?: { id: number };
    second?: { id: number };
    third?: { id: number };
  };
  defense: {
    pitcher?: { id: number; fullName: string };
    catcher?: { id: number; fullName: string };
    first?: { id: number; fullName: string };
    second?: { id: number; fullName: string };
    third?: { id: number; fullName: string };
    shortstop?: { id: number; fullName: string };
    left?: { id: number; fullName: string };
    center?: { id: number; fullName: string };
    right?: { id: number; fullName: string };
    battingTeam?: { id: number };
    fieldingTeam?: { id: number };
  };
}

export interface MlbLiveData {
  plays: {
    allPlays: MlbPlay[];
    /** Absent before the first pitch of the game. */
    currentPlay?: MlbPlay;
  };
  linescore: MlbLinescore;
}

export interface MlbLiveFeedResponse {
  gamePk: number;
  metaData: {
    wait: number;
    timeStamp: string;
  };
  gameData: MlbLiveGameData;
  liveData: MlbLiveData;
}
