import { useState, useEffect, useCallback } from "react";
import type { ScheduleGame } from "../api/types";
import type {
  ChallengeRecommendationResponse,
  AtBatRecommendationGridResponse,
  GameAtBatHistoryResponse,
} from "../api/types";
import {
  fetchLatestRecommendation,
  fetchCurrentAtBatGrid,
  fetchGameAtBatHistory,
  fetchTodaySchedule,
} from "../api/client";
import { LivePitchCard } from "../components/LivePitchCard";
import { PreAtBatBanner } from "../components/PreAtBatBanner";
import { AtBatHistory } from "../components/AtBatHistory";
import { StatusDot } from "../components/StatusDot";

// ─────────────────────────────────────────────────────────────────────────────
// Props + helpers
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  game: ScheduleGame;
  onBack: () => void;
}

const LIVE_PITCH_POLL_MS  = 5_000;
const PRE_BAT_POLL_MS     = 8_000;
const HISTORY_POLL_MS     = 15_000;
const SCHEDULE_REFRESH_MS = 30_000;

function PulsingDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
}

function ScorePill({ abbrev, score, isWinner }: { abbrev: string; score: number | null; isWinner: boolean }) {
  return (
    <div className={`text-center ${isWinner ? "text-white" : "text-white/45"}`}>
      <p className="text-xs font-mono">{abbrev}</p>
      <p className="text-2xl font-bold font-mono tabular-nums">{score ?? "-"}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function GameDetailScreen({ game: initialGame, onBack }: Props) {
  // Keep a locally-refreshed copy so score/inning/count update without a page reload
  const [game, setGame] = useState<ScheduleGame>(initialGame);

  useEffect(() => {
    async function refreshGame() {
      const r = await fetchTodaySchedule();
      if (r.status === "ok") {
        const updated = r.data.games.find((g) => g.gamePk === initialGame.gamePk);
        if (updated) setGame(updated);
      }
    }
    void refreshGame();
    const id = setInterval(() => void refreshGame(), SCHEDULE_REFRESH_MS);
    return () => clearInterval(id);
  }, [initialGame.gamePk]);

  const isLive   = game.abstractState === "Live";
  const isFinal  = game.abstractState === "Final";
  const isPre    = game.abstractState === "Preview";

  const awayAbbrev = game.awayTeamAbbrev || game.awayTeamName.slice(0, 3).toUpperCase();
  const homeAbbrev = game.homeTeamAbbrev || game.homeTeamName.slice(0, 3).toUpperCase();
  const awayWins = (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWins = (game.homeScore ?? 0) > (game.awayScore ?? 0);

  // ── Live mode state ───────────────────────────────────────────────────────
  const [livePitch, setLivePitch] = useState<ChallengeRecommendationResponse | null>(null);
  const [preBat, setPreBat] = useState<AtBatRecommendationGridResponse | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [liveLastUpdated, setLiveLastUpdated] = useState<Date | null>(null);

  // ── History state ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<GameAtBatHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Live polling ──────────────────────────────────────────────────────────
  const pollLive = useCallback(async () => {
    if (!isLive) return;
    const [pitchResult, preBatResult] = await Promise.all([
      fetchLatestRecommendation(game.gamePk),
      fetchCurrentAtBatGrid(game.gamePk),
    ]);
    if (pitchResult.status === "ok") setLivePitch(pitchResult.data);
    else if (pitchResult.status === "no_content") setLivePitch(null);

    if (preBatResult.status === "ok") setPreBat(preBatResult.data);
    else if (preBatResult.status === "no_content") setPreBat(null);

    setLiveLastUpdated(new Date());
  }, [game.gamePk, isLive]);

  useEffect(() => {
    if (!isLive) return;
    void pollLive();
    const id = setInterval(() => void pollLive(), LIVE_PITCH_POLL_MS);
    return () => clearInterval(id);
  }, [isLive, pollLive]);

  // ── History polling / loading ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!game.isTracked) return;
    setHistoryLoading(true);
    const result = await fetchGameAtBatHistory(game.gamePk);
    if (result.status === "ok") setHistory(result.data);
    setHistoryLoading(false);
  }, [game.gamePk, game.isTracked]);

  useEffect(() => {
    void loadHistory();
    if (!isLive) return;
    const id = setInterval(() => void loadHistory(), HISTORY_POLL_MS);
    return () => clearInterval(id);
  }, [isLive, loadHistory]);

  // ── Pre-bat polling (separate for banner update rate) ─────────────────────
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(async () => {
      const r = await fetchCurrentAtBatGrid(game.gamePk);
      if (r.status === "ok") setPreBat(r.data);
    }, PRE_BAT_POLL_MS);
    return () => clearInterval(id);
  }, [isLive, game.gamePk]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const liveUpdatedStr = liveLastUpdated
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(liveLastUpdated)
    : null;

  return (
    <div className="space-y-6">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors"
      >
        <span>←</span> All games
      </button>

      {/* Game header */}
      <div className="rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${
            isLive ? "text-red-400" : isFinal ? "text-slate-400" : "text-amber-400"
          }`}>
            {game.detailedState}
          </span>
          <div className="flex items-center gap-2">
            {isLive && <PulsingDot />}
            {liveUpdatedStr && isLive && (
              <span className="text-[11px] text-white/25 font-mono">{liveUpdatedStr}</span>
            )}
          </div>
        </div>

        {/* Score board */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-right">
            <p className="text-xs text-white/40 mb-1">{game.awayTeamName}</p>
            <ScorePill abbrev={awayAbbrev} score={game.awayScore} isWinner={awayWins} />
          </div>

          <div className="text-center px-2">
            {isLive && game.currentInning ? (
              <div className="space-y-1">
                <p className="text-lg font-mono text-white/60">
                  {game.currentInningHalf === "Top" ? "▲" : "▼"}&nbsp;{game.currentInning}
                </p>
                {game.balls !== null && game.strikes !== null && (
                  <p className="text-xs font-mono text-white/40">
                    {game.balls}-{game.strikes} · {game.outs} out{game.outs !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-white/20 font-mono text-lg">@</p>
            )}
          </div>

          <div className="text-left">
            <p className="text-xs text-white/40 mb-1">{game.homeTeamName}</p>
            <ScorePill abbrev={homeAbbrev} score={game.homeScore} isWinner={homeWins} />
          </div>
        </div>

        {/* Tracking badge */}
        {!game.isTracked && (
          <p className="text-center text-xs text-white/30 font-mono mt-4">
            This game is not yet tracked by the recommendation pipeline.
          </p>
        )}
      </div>

      {/* ── LIVE MODE ─────────────────────────────────────────────────────── */}
      {isLive && game.isTracked && (
        <>
          {/* Pre-at-bat banner */}
          {preBat ? (
            <PreAtBatBanner
              data={preBat}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid((v) => !v)}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-6 flex items-center gap-4">
              <PulsingDot />
              <p className="text-sm text-white/40">Waiting for at-bat data…</p>
            </div>
          )}

          {/* Latest called-strike card */}
          {livePitch ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Called Strike</p>
                <PulsingDot />
              </div>
              <LivePitchCard data={livePitch} />
            </section>
          ) : preBat ? (
            <div className="rounded-xl border border-white/10 bg-white/3 px-5 py-4 flex items-center gap-3">
              <span className="text-lg">⏳</span>
              <p className="text-sm text-white/50">No called strike yet this at-bat.</p>
            </div>
          ) : null}

          {/* In-game history */}
          {history && history.atBats.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40 font-mono uppercase tracking-widest">At-bat history</p>
                <StatusDot status="live" label="updating" />
              </div>
              <AtBatHistory atBats={history.atBats} />
            </section>
          )}
        </>
      )}

      {/* ── PRE-GAME MODE ─────────────────────────────────────────────────── */}
      {isPre && (
        <div className="rounded-2xl border border-white/10 bg-white/3 px-6 py-10 text-center space-y-2">
          <p className="text-3xl">⏰</p>
          <p className="text-white/60 font-medium">Game hasn't started yet</p>
          <p className="text-sm text-white/30">
            Recommendations will appear once the pipeline begins tracking this game.
          </p>
        </div>
      )}

      {/* ── POST-GAME MODE ────────────────────────────────────────────────── */}
      {isFinal && (
        <section className="space-y-3">
          <p className="text-xs text-white/40 font-mono uppercase tracking-widest">At-bat review</p>

          {historyLoading && !history && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          )}

          {!historyLoading && !history && game.isTracked && (
            <div className="rounded-xl border border-white/10 px-5 py-6 text-center">
              <p className="text-sm text-white/40">No at-bat data found for this game.</p>
            </div>
          )}

          {!game.isTracked && (
            <div className="rounded-xl border border-white/10 px-5 py-8 text-center space-y-2">
              <p className="text-2xl">📭</p>
              <p className="text-sm text-white/50">
                This game was not tracked by the recommendation pipeline.
              </p>
              <p className="text-xs text-white/30">
                Only games the backend ingested during the live period have recommendation history.
              </p>
            </div>
          )}

          {history && <AtBatHistory atBats={history.atBats} />}
        </section>
      )}
    </div>
  );
}
