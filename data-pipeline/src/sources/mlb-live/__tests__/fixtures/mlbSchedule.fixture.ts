import {
  MlbScheduleGame,
  MlbScheduleResponse,
  MlbGameStatus,
  MlbAbstractGameState,
  MlbDetailedState,
} from "../../mlbLive.api.types";

// ---------------------------------------------------------------------------
// Status builders
// ---------------------------------------------------------------------------

export function buildGameStatus(
  abstractState: MlbAbstractGameState,
  detailedState: MlbDetailedState
): MlbGameStatus {
  const codeMap: Record<MlbAbstractGameState, "P" | "L" | "F"> = {
    Preview: "P",
    Live: "L",
    Final: "F",
  };
  return {
    abstractGameState: abstractState,
    detailedState,
    abstractGameCode: codeMap[abstractState],
    statusCode: codeMap[abstractState],
  };
}

export const FINAL_STATUS = buildGameStatus("Final", "Final");
export const LIVE_STATUS = buildGameStatus("Live", "In Progress");
export const PREVIEW_STATUS = buildGameStatus("Preview", "Scheduled");
export const SUSPENDED_STATUS = buildGameStatus("Live", "Suspended");

// ---------------------------------------------------------------------------
// Game builder — override any fields you care about
// ---------------------------------------------------------------------------

let _gamePkCounter = 800000;

export function buildScheduleGame(
  overrides: Partial<MlbScheduleGame> = {}
): MlbScheduleGame {
  const gamePk = overrides.gamePk ?? ++_gamePkCounter;
  return {
    gamePk,
    gameDate: "2026-06-16T23:10:00Z",
    officialDate: "2026-06-16",
    status: FINAL_STATUS,
    teams: {
      home: { team: { id: 143, name: "Philadelphia Phillies", abbreviation: "PHI" } },
      away: { team: { id: 146, name: "Miami Marlins", abbreviation: "MIA" } },
    },
    doubleHeader: "N",
    gameNumber: 1,
    ...overrides,
  };
}

// Convenience pre-built games matching what the real API returned on 2026-06-16
export const GAME_FINAL = buildScheduleGame({
  gamePk: 823451,
  status: FINAL_STATUS,
  teams: {
    home: { team: { id: 143, name: "Philadelphia Phillies", abbreviation: "PHI" } },
    away: { team: { id: 146, name: "Miami Marlins", abbreviation: "MIA" } },
  },
});

export const GAME_IN_PROGRESS = buildScheduleGame({
  gamePk: 824991,
  status: LIVE_STATUS,
  gameDate: "2026-06-17T00:40:00Z",
  officialDate: "2026-06-16",
  teams: {
    home: { team: { id: 133, name: "Oakland Athletics", abbreviation: "ATH" } },
    away: { team: { id: 134, name: "Pittsburgh Pirates", abbreviation: "PIT" } },
  },
});

export const GAME_SUSPENDED = buildScheduleGame({
  gamePk: 824912,
  status: SUSPENDED_STATUS,
  teams: {
    home: { team: { id: 144, name: "Atlanta Braves", abbreviation: "ATL" } },
    away: { team: { id: 137, name: "San Francisco Giants", abbreviation: "SF" } },
  },
});

export const GAME_PREVIEW = buildScheduleGame({
  gamePk: 825100,
  status: PREVIEW_STATUS,
  gameDate: "2026-06-17T02:10:00Z",
  officialDate: "2026-06-16",
  teams: {
    home: { team: { id: 108, name: "Los Angeles Angels", abbreviation: "LAA" } },
    away: { team: { id: 117, name: "Houston Astros", abbreviation: "HOU" } },
  },
});

// ---------------------------------------------------------------------------
// Schedule response builder
// ---------------------------------------------------------------------------

export function buildScheduleResponse(
  games: MlbScheduleGame[],
  date = "2026-06-16"
): MlbScheduleResponse {
  const inProgress = games.filter(
    (g) => g.status.abstractGameState === "Live"
  ).length;
  return {
    totalGames: games.length,
    totalGamesInProgress: inProgress,
    dates: [{ date, games }],
  };
}

export function buildEmptyScheduleResponse(date = "2026-06-16"): MlbScheduleResponse {
  return { totalGames: 0, totalGamesInProgress: 0, dates: [{ date, games: [] }] };
}
