import type {
  ScheduleResponse,
  ChallengeRecommendationResponse,
  AtBatRecommendationGridResponse,
  GameAtBatHistoryResponse,
} from "./types";

const BASE = "/api";

export type ApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "no_content" }
  | { status: "not_found" }
  | { status: "error"; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  server: boolean;
  db: boolean;
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch("/health");
    if (!res.ok) return { server: false, db: false };
    const body = (await res.json()) as { status: string; db?: string };
    return { server: true, db: body.db === "connected" };
  } catch {
    return { server: false, db: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTodaySchedule(date?: string): Promise<ApiResult<ScheduleResponse>> {
  try {
    const url = date
      ? `${BASE}/schedule/today?date=${date}`
      : `${BASE}/schedule/today`;
    const res = await fetch(url);
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    return { status: "ok", data: (await res.json()) as ScheduleResponse };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Network error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live recommendation
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchLatestRecommendation(
  gamePk: number
): Promise<ApiResult<ChallengeRecommendationResponse>> {
  try {
    const res = await fetch(`${BASE}/games/${gamePk}/recommendation`);
    if (res.status === 204) return { status: "no_content" };
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    return { status: "ok", data: (await res.json()) as ChallengeRecommendationResponse };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Network error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-at-bat grid
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCurrentAtBatGrid(
  gamePk: number
): Promise<ApiResult<AtBatRecommendationGridResponse>> {
  try {
    const res = await fetch(`${BASE}/games/${gamePk}/at-bats/current/recommendations`);
    if (res.status === 204) return { status: "no_content" };
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    return { status: "ok", data: (await res.json()) as AtBatRecommendationGridResponse };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Network error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Game at-bat history
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGameAtBatHistory(
  gamePk: number
): Promise<ApiResult<GameAtBatHistoryResponse>> {
  try {
    const res = await fetch(`${BASE}/games/${gamePk}/at-bats`);
    if (res.status === 204) return { status: "no_content" };
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    return { status: "ok", data: (await res.json()) as GameAtBatHistoryResponse };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Network error" };
  }
}
