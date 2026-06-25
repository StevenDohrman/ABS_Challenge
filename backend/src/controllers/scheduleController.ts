import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { gameHasTriggeredRecommendation } from "../db/recommendationRepository";
import type { ScheduleResponseDto, ScheduleGameDto, GameAbstractState } from "../challenge.dto";

// ─────────────────────────────────────────────────────────────────────────────
// MLB Stats API — minimal inline types for what we need from the schedule
// ─────────────────────────────────────────────────────────────────────────────

interface MlbTeamRef { id: number; name: string; abbreviation?: string }
interface MlbScheduleTeamEntry { team: MlbTeamRef; score?: number }
interface MlbLinescore {
  currentInning?: number;
  inningHalf?: string;   // "Top" | "Bottom"
  outs?: number;
  balls?: number;
  strikes?: number;
}
interface MlbScheduleGameRaw {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  status: { abstractGameState: string; detailedState: string };
  teams: { home: MlbScheduleTeamEntry; away: MlbScheduleTeamEntry };
  linescore?: MlbLinescore;
}
interface MlbScheduleResponse {
  dates: Array<{ date: string; games: MlbScheduleGameRaw[] }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/schedule/today   (or ?date=YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch today's MLB schedule from the Stats API, enrich each game with
 * tracking / recommendation status from our DB, and return the merged list.
 *
 * Accepts an optional `date` query param (YYYY-MM-DD) for testing against
 * historical dates. Defaults to today in ET (MLB official date cutoff).
 */
export async function getTodaySchedule(
  req: Request,
  res: Response
): Promise<void> {
  const date = typeof req.query["date"] === "string"
    ? req.query["date"]
    : mlbToday();

  // ── 1. Fetch schedule from MLB Stats API ──────────────────────────────────
  let rawGames: MlbScheduleGameRaw[] = [];
  try {
    const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
    url.searchParams.set("sportId", "1");
    url.searchParams.set("date", date);
    url.searchParams.set("hydrate", "linescore,team");

    const mlbRes = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!mlbRes.ok) {
      res.status(502).json({ error: "MLB Stats API returned an error" });
      return;
    }
    const schedule = (await mlbRes.json()) as MlbScheduleResponse;
    const dateEntry = schedule.dates.find((d) => d.date === date);
    rawGames = dateEntry?.games ?? [];
  } catch (err) {
    console.error("[scheduleController] MLB fetch failed:", err);
    res.status(502).json({ error: "Failed to fetch schedule from MLB Stats API" });
    return;
  }

  if (rawGames.length === 0) {
    const dto: ScheduleResponseDto = { date, games: [] };
    res.json(dto);
    return;
  }

  // ── 2. Check which gamePks are tracked in our DB ──────────────────────────
  // DB lookups are best-effort: if the database is unreachable we still return
  // the schedule from MLB — games just show as untracked.
  const gamePks = rawGames.map((g) => g.gamePk);
  let trackedSet = new Set<number>();
  let triggeredSet = new Set<number>();

  try {
    const trackedGames = await prisma.game.findMany({
      where: { gamePk: { in: gamePks } },
      select: { gamePk: true },
    });
    trackedSet = new Set(trackedGames.map((g) => g.gamePk));

    // ── 3. Check which tracked games have triggered recommendations ─────────
    const triggeredFlags = await Promise.all(
      [...trackedSet].map(async (pk) => ({
        gamePk: pk,
        hasTriggered: await gameHasTriggeredRecommendation(pk),
      }))
    );
    triggeredSet = new Set(
      triggeredFlags.filter((f) => f.hasTriggered).map((f) => f.gamePk)
    );
  } catch (dbErr) {
    console.warn("[scheduleController] DB unavailable — returning schedule without tracking data:", dbErr instanceof Error ? dbErr.message : dbErr);
  }

  // ── 4. Map to DTO ─────────────────────────────────────────────────────────
  const games: ScheduleGameDto[] = rawGames.map((g) => {
    const isLive = g.status.abstractGameState === "Live";
    const ls = g.linescore;

    return {
      gamePk: g.gamePk,
      officialDate: g.officialDate,
      scheduledStartTime: g.gameDate,
      abstractState: g.status.abstractGameState as GameAbstractState,
      detailedState: g.status.detailedState,

      homeTeamId: g.teams.home.team.id,
      homeTeamName: g.teams.home.team.name,
      homeTeamAbbrev: g.teams.home.team.abbreviation ?? "",
      awayTeamId: g.teams.away.team.id,
      awayTeamName: g.teams.away.team.name,
      awayTeamAbbrev: g.teams.away.team.abbreviation ?? "",

      homeScore: g.teams.home.score ?? null,
      awayScore: g.teams.away.score ?? null,

      currentInning: isLive ? (ls?.currentInning ?? null) : null,
      currentInningHalf: isLive ? formatHalf(ls?.inningHalf) : null,
      balls: isLive ? (ls?.balls ?? null) : null,
      strikes: isLive ? (ls?.strikes ?? null) : null,
      outs: isLive ? (ls?.outs ?? null) : null,

      isTracked: trackedSet.has(g.gamePk),
      hasTriggeredRecommendation: triggeredSet.has(g.gamePk),
    };
  });

  // Sort: Live first, then Preview by start time, then Final
  games.sort((a, b) => {
    const order = { Live: 0, Preview: 1, Final: 2 };
    const ao = order[a.abstractState] ?? 3;
    const bo = order[b.abstractState] ?? 3;
    if (ao !== bo) return ao - bo;
    return a.scheduledStartTime.localeCompare(b.scheduledStartTime);
  });

  const dto: ScheduleResponseDto = { date, games };
  res.json(dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatHalf(half?: string): string | null {
  if (!half) return null;
  const lower = half.toLowerCase();
  if (lower === "top") return "Top";
  if (lower === "bottom") return "Bot";
  return half;
}

/**
 * MLB uses Eastern Time for official game dates (UTC-5 conservative offset).
 */
function mlbToday(): string {
  const etOffset = -5 * 60;
  const etMs = Date.now() + etOffset * 60 * 1_000;
  return new Date(etMs).toISOString().slice(0, 10);
}
