import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchHealth } from "../api/client";
import { GameCard } from "../components/GameCard";
import { StatusDot } from "../components/StatusDot";
import { ScheduleDateSlider } from "../components/ScheduleDateSlider";
import { EmptyState } from "../components/ui/EmptyState";
import { GameCardSkeletonGrid } from "../components/ui/LoadingSkeleton";
import { useSchedule } from "../hooks/useSchedule";
import { useInterval } from "../hooks/useInterval";
import { formatTimestamp } from "../utils/format";
import {
  buildScheduleDateOptions,
  daysAgoForDate,
  isDateInScheduleWindow,
  mlbDateDaysAgo,
} from "../utils/scheduleDates";

const HEALTH_POLL_MS = 10_000;

export function GamesDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateOptions = useMemo(() => buildScheduleDateOptions(), []);

  const initialDaysAgo = useMemo(() => {
    const param = searchParams.get("date");
    if (param && isDateInScheduleWindow(param)) return daysAgoForDate(param);
    return 0;
  }, [searchParams]);

  const [daysAgo, setDaysAgo] = useState(initialDaysAgo);
  const selectedDate = mlbDateDaysAgo(daysAgo);
  const isToday = daysAgo === 0;

  const { games, scheduleDate: loadedDate, loading, error, lastRefresh, reload } =
    useSchedule(selectedDate);

  const [serverOnline, setServerOnline] = useState(false);
  const [dbOnline, setDbOnline] = useState(false);

  const handleDaysAgoChange = useCallback(
    (nextDaysAgo: number) => {
      setDaysAgo(nextDaysAgo);
      const nextDate = mlbDateDaysAgo(nextDaysAgo);
      setSearchParams(nextDaysAgo === 0 ? {} : { date: nextDate }, { replace: true });
    },
    [setSearchParams]
  );

  useEffect(() => {
    const param = searchParams.get("date");
    if (param && isDateInScheduleWindow(param)) {
      setDaysAgo(daysAgoForDate(param));
    }
  }, [searchParams]);

  useInterval(
    async () => {
      const h = await fetchHealth();
      setServerOnline(h.server);
      setDbOnline(h.db);
    },
    HEALTH_POLL_MS
  );

  const liveGames = games.filter((g) => g.abstractState === "Live");
  const previewGames = games.filter((g) => g.abstractState === "Preview");
  const finalGames = games.filter((g) => g.abstractState === "Final");

  const lastRefreshStr = lastRefresh ? formatTimestamp(lastRefresh) : null;
  const selectedLabel = dateOptions[daysAgo]?.longLabel;
  const displayDate = loadedDate || selectedDate;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isToday ? "Today's Games" : "Games"}
          </h1>
          {selectedLabel && (
            <p className="text-sm text-white/40 font-mono mt-0.5">{selectedLabel}</p>
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

      <ScheduleDateSlider daysAgo={daysAgo} onChange={handleDaysAgoChange} />

      {/* Server offline warning */}
      {!serverOnline && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
          <p className="text-sm text-red-300">
            Backend at <span className="font-mono">localhost:3001</span> is unreachable.
            Run <span className="font-mono">npm run backend:dev</span> to start it.
          </p>
        </div>
      )}

      {/* DB disconnected warning */}
      {serverOnline && !dbOnline && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
          <div className="text-sm text-amber-300 space-y-0.5">
            <p className="font-semibold">Database not connected — recommendations unavailable</p>
            <p className="text-amber-400/70 text-xs">
              The schedule loads fine, but live tracking requires a working Supabase connection.
              Check <span className="font-mono">backend/.env</span> → <span className="font-mono">DATABASE_URL</span>.
            </p>
          </div>
        </div>
      )}

      {loading && games.length === 0 && <GameCardSkeletonGrid />}

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-4 space-y-2">
          <p className="text-sm text-red-300 font-semibold">Failed to load schedule</p>
          <p className="text-xs text-red-400/70 font-mono">{error}</p>
          <button
            onClick={() => void reload()}
            className="text-xs text-red-300 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* No games */}
      {!loading && !error && games.length === 0 && (
        <EmptyState
          size="md"
          title="No MLB games scheduled for this date."
          className="py-12"
        />
      )}

      {/* Live games */}
      {liveGames.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="Live" count={liveGames.length} accent="text-red-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveGames.map((g) => (
              <GameCard key={g.gamePk} game={g} scheduleDate={displayDate} />
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
              <GameCard key={g.gamePk} game={g} scheduleDate={displayDate} />
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
              <GameCard key={g.gamePk} game={g} scheduleDate={displayDate} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-white/20 font-mono text-center pb-4">
        Schedule from MLB Stats API · Recommendations from ABS engine
        {isToday ? " · Auto-refreshes every 30s" : ""}
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
