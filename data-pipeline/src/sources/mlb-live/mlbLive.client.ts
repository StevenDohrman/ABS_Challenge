import axios, { AxiosInstance } from "axios";
import {
  MlbLiveFeedResponse,
  MlbScheduleResponse,
} from "./mlbLive.api.types";

const MLB_STATS_BASE_V1 = "https://statsapi.mlb.com/api/v1";
const MLB_STATS_BASE_V1_1 = "https://statsapi.mlb.com/api/v1.1";

/**
 * Shared axios instance with sensible defaults for the MLB Stats API.
 * @internal Exported for test instrumentation only — use the named functions.
 */
export const mlbHttp: AxiosInstance = axios.create({
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Fetch the schedule for one day.
 *
 * @param date - ISO date string (YYYY-MM-DD). Defaults to today in UTC.
 */
export async function fetchSchedule(date?: string): Promise<MlbScheduleResponse> {
  const gameDate = date ?? utcToday();

  const { data } = await mlbHttp.get<MlbScheduleResponse>(
    `${MLB_STATS_BASE_V1}/schedule`,
    {
      params: {
        sportId: 1,       // MLB
        date: gameDate,
        hydrate: "linescore,team",
      },
    }
  );

  return data;
}

/**
 * Fetch the full live feed for a single game.
 * This is the primary polling endpoint — call it on every poll cycle.
 */
export async function fetchLiveFeed(gamePk: number): Promise<MlbLiveFeedResponse> {
  const { data } = await mlbHttp.get<MlbLiveFeedResponse>(
    `${MLB_STATS_BASE_V1_1}/game/${gamePk}/feed/live`
  );

  return data;
}

/**
 * Fetch only the diff since a known timestamp.
 * The API returns a partial feed with only events that changed after `startTimecode`.
 * Useful for reducing payload size after the first full fetch.
 *
 * @param startTimecode - The metaData.timeStamp from the last full or diff response.
 */
export async function fetchLiveFeedDiff(
  gamePk: number,
  startTimecode: string
): Promise<MlbLiveFeedResponse> {
  const { data } = await mlbHttp.get<MlbLiveFeedResponse>(
    `${MLB_STATS_BASE_V1_1}/game/${gamePk}/feed/live/diffPatch`,
    {
      params: { startTimecode },
    }
  );

  return data;
}

interface MlbPeopleResponse {
  people?: Array<{ id: number; fullName?: string }>;
}

const PEOPLE_LOOKUP_BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Resolve full names for arbitrary MLB person IDs via the People endpoint.
 * Works for any valid player, active or historical, with no playing-time
 * threshold — unlike Savant's season leaderboard exports. Used as a direct
 * fallback for player IDs that show up in rankings/audits without a name.
 */
export async function fetchPeopleNames(
  personIds: number[]
): Promise<Record<number, string>> {
  const unique = [...new Set(personIds)].filter(
    (id) => Number.isFinite(id) && id > 0
  );
  if (unique.length === 0) return {};

  const names: Record<number, string> = {};

  for (const batch of chunk(unique, PEOPLE_LOOKUP_BATCH_SIZE)) {
    const { data } = await mlbHttp.get<MlbPeopleResponse>(
      `${MLB_STATS_BASE_V1}/people`,
      { params: { personIds: batch.join(",") } }
    );
    for (const person of data.people ?? []) {
      if (person?.id && person.fullName) {
        names[person.id] = person.fullName;
      }
    }
  }

  return names;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
