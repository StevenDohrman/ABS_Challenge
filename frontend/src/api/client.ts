import type {
  ScheduleResponse,
  ChallengeRecommendationResponse,
  AtBatRecommendationGridResponse,
  GameAtBatHistoryResponse,
  PostgameAuditResponse,
  RankingsBundleResponse,
} from "./types";
import { fetchJson, type ApiResult } from "./fetch";

export type { ApiResult } from "./fetch";

const BASE = "/api";

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
  const url = date ? `${BASE}/schedule/today?date=${date}` : `${BASE}/schedule/today`;
  return fetchJson<ScheduleResponse>(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Live recommendation
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchLatestRecommendation(
  gamePk: number
): Promise<ApiResult<ChallengeRecommendationResponse>> {
  return fetchJson<ChallengeRecommendationResponse>(
    `${BASE}/games/${gamePk}/recommendation`,
    { noContent: true, notFound: true }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-at-bat grid
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCurrentAtBatGrid(
  gamePk: number
): Promise<ApiResult<AtBatRecommendationGridResponse>> {
  return fetchJson<AtBatRecommendationGridResponse>(
    `${BASE}/games/${gamePk}/at-bats/current/recommendations`,
    { noContent: true, notFound: true }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game at-bat history
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchGameAtBatHistory(
  gamePk: number
): Promise<ApiResult<GameAtBatHistoryResponse>> {
  return fetchJson<GameAtBatHistoryResponse>(
    `${BASE}/games/${gamePk}/at-bats`,
    { noContent: true, notFound: true }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgame audit
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPostgameAudit(
  gamePk: number
): Promise<ApiResult<PostgameAuditResponse>> {
  return fetchJson<PostgameAuditResponse>(
    `${BASE}/games/${gamePk}/postgame-audit`,
    { notFound: true }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rankings
// ─────────────────────────────────────────────────────────────────────────────

export interface RankingsFetchOptions {
  period?: "week" | "season";
}

function rankingsQuery(opts: RankingsFetchOptions): string {
  const params = new URLSearchParams();
  if (opts.period) params.set("period", opts.period);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export async function fetchRankingsBundle(
  opts: RankingsFetchOptions = {}
): Promise<ApiResult<RankingsBundleResponse>> {
  return fetchJson<RankingsBundleResponse>(
    `${BASE}/rankings${rankingsQuery(opts)}`,
    { parseErrorBody: true }
  );
}
