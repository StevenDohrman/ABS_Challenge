import { fetchSchedule } from "./mlbLive.client";
import { MlbAbstractGameState, MlbScheduleGame } from "./mlbLive.api.types";

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

/**
 * MLB uses Eastern Time for official game dates.
 * A game finishing at 1 AM ET on June 17 still has an officialDate of June 16.
 * We approximate this by shifting UTC by -4 or -5 hours depending on DST.
 *
 * This is intentionally simple. For production, use a proper TZ library.
 */
function mlbToday(): string {
  const now = new Date();
  // ET is UTC-4 (EDT) or UTC-5 (EST). Use -5 as a conservative offset so we
  // never accidentally advance to the next day too early.
  const etOffset = -5 * 60;
  const etMs = now.getTime() + etOffset * 60 * 1_000;
  return new Date(etMs).toISOString().slice(0, 10);
}
