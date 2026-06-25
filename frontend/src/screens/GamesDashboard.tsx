import { useEffect, useState, useCallback } from "react";
import { fetchTodaySchedule } from "../api/client";
import type { ScheduleGame } from "../api/types";
import { GameCard } from "../components/GameCard";
import { StatusDot } from "../components/StatusDot";

interface Props {
  onSelectGame: (game: ScheduleGame) => void;
  serverOnline: boolean;
  dbOnline: boolean;
}

const REFRESH_MS = 30_000;

export function GamesDashboard({ onSelectGame, serverOnline, dbOnline }: Props) {
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [date, setDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchTodaySchedule();
    if (result.status === "ok") {
      setGames(result.data.games);
      setDate(result.data.date);
      setError(null);
      setLastRefresh(new Date());
    } else if (result.status === "error") {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const liveGames   = games.filter((g) => g.abstractState === "Live");
  const previewGames = games.filter((g) => g.abstractState === "Preview");
  const finalGames  = games.filter((g) => g.abstractState === "Final");

  const lastRefreshStr = lastRefresh
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(lastRefresh)
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">⚾ ABS Challenge Advisor</h1>
          {date && (
            <p className="text-sm text-white/40 font-mono mt-0.5">
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusDot
            status={serverOnline ? "live" : "offline"}
            label={serverOnline ? "Server online" : "Server offline"}
          />
          <StatusDot
            status={dbOnline ? "live" : serverOnline ? "error" : "offline"}
            label={dbOnline ? "DB connected" : "DB disconnected"}
          />
          {lastRefreshStr && (
            <span className="text-[11px] text-white/25 font-mono">Updated {lastRefreshStr}</span>
          )}
        </div>
      </div>

      {/* Server offline warning */}
      {!serverOnline && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex items-center gap-3">
          <span>⚠️</span>
          <p className="text-sm text-red-300">
            Backend at <span className="font-mono">localhost:3001</span> is unreachable.
            Run <span className="font-mono">npm run backend:dev</span> to start it.
          </p>
        </div>
      )}

      {/* DB disconnected warning */}
      {serverOnline && !dbOnline && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-center gap-3">
          <span>⚠️</span>
          <div className="text-sm text-amber-300 space-y-0.5">
            <p className="font-semibold">Database not connected — recommendations unavailable</p>
            <p className="text-amber-400/70 text-xs">
              The schedule loads fine, but live tracking requires a working Supabase connection.
              Check <span className="font-mono">backend/.env</span> → <span className="font-mono">DATABASE_URL</span>.
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && games.length === 0 && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-4 space-y-2">
          <p className="text-sm text-red-300 font-semibold">Failed to load schedule</p>
          <p className="text-xs text-red-400/70 font-mono">{error}</p>
          <button
            onClick={() => void load()}
            className="text-xs text-red-300 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* No games */}
      {!loading && !error && games.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/3 px-6 py-12 text-center space-y-2">
          <p className="text-3xl">🏟</p>
          <p className="text-white/50">No MLB games scheduled today.</p>
        </div>
      )}

      {/* Live games */}
      {liveGames.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="Live" count={liveGames.length} accent="text-red-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveGames.map((g) => (
              <GameCard key={g.gamePk} game={g} onClick={() => onSelectGame(g)} />
            ))}
          </div>
        </section>
      )}

      {/* Preview / upcoming games */}
      {previewGames.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="Upcoming" count={previewGames.length} accent="text-amber-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {previewGames.map((g) => (
              <GameCard key={g.gamePk} game={g} onClick={() => onSelectGame(g)} />
            ))}
          </div>
        </section>
      )}

      {/* Final games */}
      {finalGames.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="Final" count={finalGames.length} accent="text-slate-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {finalGames.map((g) => (
              <GameCard key={g.gamePk} game={g} onClick={() => onSelectGame(g)} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-white/20 font-mono text-center pb-4">
        Schedule from MLB Stats API · Recommendations from ABS engine · Auto-refreshes every 30s
      </p>
    </div>
  );
}

function SectionHeader({ label, count, accent }: { label: string; count: number; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono font-semibold uppercase tracking-widest ${accent}`}>
        {label}
      </span>
      <span className="text-xs font-mono text-white/25">{count}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
