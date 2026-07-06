import { Link, useParams, useSearchParams } from "react-router-dom";
import type { ScheduleGame } from "../api/types";
import { LivePitchCard } from "../components/LivePitchCard";
import { PreAtBatBanner } from "../components/PreAtBatBanner";
import { AtBatHistory } from "../components/AtBatHistory";
import { PostgameAuditSummary } from "../components/PostgameAuditSummary";
import { StatusDot } from "../components/StatusDot";
import { EmptyState } from "../components/ui/EmptyState";
import { GameDetailSkeleton, HistoryRowSkeleton } from "../components/ui/LoadingSkeleton";
import { PulsingDot } from "../components/ui/PulsingDot";
import { useGameDetailData } from "../hooks/useGameDetailData";
import { useScheduleGame } from "../hooks/useSchedule";
import { formatInningShort, teamAbbrev } from "../utils/baseballDisplay";
import { formatTimestamp } from "../utils/format";

const CHALLENGES_PER_TEAM = 2;

function ChallengeBar({
  abbrev,
  remaining,
  label,
}: {
  abbrev: string;
  remaining: number | null;
  label: string;
}) {
  if (remaining === null) return null;
  const total = CHALLENGES_PER_TEAM;
  return (
    <div className="flex flex-col items-center gap-1.5" title={label}>
      <span className="text-[10px] font-mono text-white/35">{abbrev}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-sm ${
              i < remaining
                ? "bg-emerald-500/70 border border-emerald-400/50"
                : "bg-white/10 border border-white/10"
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-mono ${remaining === 0 ? "text-red-400" : "text-white/40"}`}>
        {remaining}/{total}
      </span>
    </div>
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

export function GameDetailScreen() {
  const { gamePk: gamePkParam } = useParams<{ gamePk: string }>();
  const [searchParams] = useSearchParams();
  const scheduleDate = searchParams.get("date") ?? undefined;
  const gamePk = parseInt(gamePkParam ?? "", 10);

  const { game, loading: gameLoading } = useScheduleGame(gamePk, scheduleDate);

  if (isNaN(gamePk) || (!gameLoading && !game)) {
    return (
      <div className="space-y-4">
        <Link
          to={scheduleDate ? `/?date=${scheduleDate}` : "/"}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors"
        >
          <span>←</span> All games
        </Link>
        <EmptyState title="Game not found." />
      </div>
    );
  }

  if (!game) {
    return <GameDetailSkeleton />;
  }

  return <GameDetailContent game={game} scheduleDate={scheduleDate} />;
}

function GameDetailContent({
  game,
  scheduleDate,
}: {
  game: ScheduleGame;
  scheduleDate?: string;
}) {
  const isLive = game.abstractState === "Live";
  const isFinal = game.abstractState === "Final";
  const isPre = game.abstractState === "Preview";

  const awayAbbrev = teamAbbrev(game.awayTeamAbbrev, game.awayTeamName);
  const homeAbbrev = teamAbbrev(game.homeTeamAbbrev, game.homeTeamName);
  const awayWins = (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWins = (game.homeScore ?? 0) > (game.awayScore ?? 0);

  const {
    livePitch,
    preBat,
    showGrid,
    setShowGrid,
    liveLastUpdated,
    history,
    historyLoading,
    postgameAudit,
    auditLoading,
  } = useGameDetailData({
    gamePk: game.gamePk,
    isLive,
    isFinal,
    isTracked: game.isTracked,
  });

  const liveUpdatedStr = liveLastUpdated ? formatTimestamp(liveLastUpdated) : null;

  return (
    <div className="space-y-6">

      {/* Back button */}
      <Link
        to={scheduleDate ? `/?date=${scheduleDate}` : "/"}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors"
      >
        <span>←</span> All games
      </Link>

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
                  {formatInningShort(game.currentInningHalf, game.currentInning)}
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

        {/* Challenge counts */}
        {game.isTracked && (game.homeChallengesRemaining !== null || game.awayChallengesRemaining !== null) && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-6">
            <ChallengeBar
              abbrev={awayAbbrev}
              remaining={game.awayChallengesRemaining}
              label="Away challenges"
            />
            <div className="h-6 w-px bg-white/10" />
            <ChallengeBar
              abbrev={homeAbbrev}
              remaining={game.homeChallengesRemaining}
              label="Home challenges"
            />
          </div>
        )}

        {/* Tracking badge */}
        {!game.isTracked && isFinal && (
          <p className="text-center text-xs text-amber-400/70 font-mono mt-4">
            Backfill pending — postgame analysis will appear once the pipeline ingests this game.
          </p>
        )}
        {!game.isTracked && !isFinal && (
          <p className="text-center text-xs text-white/30 font-mono mt-4">
            This game is not yet tracked by the recommendation pipeline.
          </p>
        )}
      </div>

      {/* ── LIVE MODE ─────────────────────────────────────────────────────── */}
      {isLive && game.isTracked && (
        <>
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
        <EmptyState
          size="md"
          icon="⏰"
          title="Game hasn't started yet"
          description="Recommendations will appear once the pipeline begins tracking this game."
        />
      )}

      {/* ── POST-GAME MODE ────────────────────────────────────────────────── */}
      {isFinal && (
        <>
          <PostgameAuditSummary
            audit={postgameAudit}
            loading={auditLoading}
            awayAbbrev={awayAbbrev}
            homeAbbrev={homeAbbrev}
          />

          <section className="space-y-3">
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest">At-bat review</p>

          {historyLoading && !history && <HistoryRowSkeleton />}

          {!historyLoading && !history && game.isTracked && (
            <EmptyState title="No at-bat data found for this game." />
          )}

          {!historyLoading && !history && !game.isTracked && (
            <EmptyState
              icon="⏳"
              title="Ingesting game data from the MLB archive…"
              description="Final games are backfilled automatically; refresh in a few minutes."
            />
          )}

          {history && <AtBatHistory atBats={history.atBats} />}
          </section>
        </>
      )}
    </div>
  );
}
