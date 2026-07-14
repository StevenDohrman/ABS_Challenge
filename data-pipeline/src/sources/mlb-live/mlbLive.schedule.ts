import { fetchSchedule } from "./mlbLive.client";
import { MlbAbstractGameState, MlbScheduleGame } from "./mlbLive.api.types";
import { mlbToday } from "../../utils/mlbDates";

// ---------------------------------------------------------------------------
// Domain-level game summary (internal, not raw API)
// ---------------------------------------------------------------------------

export interface ActiveGame {
  gamePk: number;
  /** MLB official date (YYYY-MM-DD) — may differ from calendar date for late-night games. */
  officialDate: string;
  /** Full ISO-8601 scheduled start time (UTC). Use this for time-window comparisons. */
  scheduledStartTime: string;
  status: MlbAbstractGameState;
  detailedState: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
}

// ---------------------------------------------------------------------------
// Game discovery
// ---------------------------------------------------------------------------

/**
 * Return all MLB games scheduled for a given date.
 *
 * @param date - ISO date string YYYY-MM-DD. Defaults to today in ET (which
 *               MLB uses as its official game date cutoff — a game at 1 AM ET
 *               still belongs to the previous calendar day).
 */
export async function fetchGamesForDate(date?: string): Promise<ActiveGame[]> {
  const gameDate = date ?? mlbToday();
  const schedule = await fetchSchedule(gameDate);

  const dateEntry = schedule.dates.find((d) => d.date === gameDate);
  if (!dateEntry) return [];

  return dateEntry.games.map(toActiveGame);
}

/**
 * Return only games that are currently in progress.
 * Safe to call on a polling interval — filters out Preview and Final games.
 */
export async function fetchLiveGames(date?: string): Promise<ActiveGame[]> {
  const games = await fetchGamesForDate(date);
  return games.filter((g) => g.status === "Live");
}

/**
 * Return games that are live OR scheduled to start soon (within the next
 * `withinMinutes` minutes). Useful for deciding when to begin polling a game
 * before the first pitch.
 */
export async function fetchUpcomingAndLiveGames(
  withinMinutes = 30,
  date?: string
): Promise<ActiveGame[]> {
  const games = await fetchGamesForDate(date);
  const now = Date.now();
  const windowMs = withinMinutes * 60 * 1_000;

  return games.filter((g) => {
    if (g.status === "Live") return true;
    if (g.status === "Final") return false;

    // Include Preview games whose start time is approaching
    const startMs = new Date(g.scheduledStartTime).getTime();
    return startMs - now <= windowMs;
  });
}

/**
 * Return only Final games for a given official date.
 */
export async function fetchFinalGames(date?: string): Promise<ActiveGame[]> {
  const games = await fetchGamesForDate(date);
  return games.filter((g) => g.status === "Final");
}

/**
 * Return Final games across a date range (inclusive), one day at a time.
 */
export async function fetchFinalGamesInRange(
  startDate: string,
  endDate: string
): Promise<ActiveGame[]> {
  const results: ActiveGame[] = [];
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayGames = await fetchFinalGames(dateStr);
    results.push(...dayGames);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toActiveGame(game: MlbScheduleGame): ActiveGame {
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    scheduledStartTime: game.gameDate,
    status: game.status.abstractGameState,
    detailedState: game.status.detailedState,
    homeTeamId: game.teams.home.team.id,
    homeTeamName: game.teams.home.team.name,
    awayTeamId: game.teams.away.team.id,
    awayTeamName: game.teams.away.team.name,
  };
}
