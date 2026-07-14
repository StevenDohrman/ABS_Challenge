import { Link, useParams, useSearchParams } from "react-router-dom";
import type { ScheduleGame } from "../api/types";
import { LivePitchCard } from "../components/LivePitchCard";
import { PitcherChallengeHintsPanel } from "../components/PitcherChallengeHintsPanel";
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
import { BranchGameButton } from "../components/BranchGameButton";
import { GAME_RULES } from "../constants/gameRules";

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
  const total = GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM;
  return (
    <div className="flex flex-col items-center gap-1.5" title={label}>
      <span className="text-[10px] font-mono text-app-faint">{abbrev}</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-sm ${
              i < remaining
                ? "bg-emerald-500/70 border border-emerald-600/50 dark:border-emerald-400/50"
                : "app-surface-muted border border-app"
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-mono ${remaining === 0 ? "text-red-600 dark:text-red-400" : "text-app-muted"}`}>
        {remaining}/{total}
      </span>
    </div>
  );
}

function ScorePill({ abbrev, score, isWinner }: { abbrev: string; score: number | null; isWinner: boolean }) {
  return (
    <div className={`text-center ${isWinner ? "text-app" : "text-app-secondary"}`}>
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
          className="flex items-center gap-2 text-sm app-link min-h-11"
        >
          All games
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

  const pitcherChallengeHints =
    livePitch?.pitcherChallengeHints ?? preBat?.pitcherChallengeHints ?? null;

  const liveUpdatedStr = liveLastUpdated ? formatTimestamp(liveLastUpdated) : null;

  return (
    <div className="space-y-6">

      {/* Back button + branch entry */}
      <div className="flex items-center justify-between">
        <Link
          to={scheduleDate ? `/?date=${scheduleDate}` : "/"}
          className="flex items-center gap-2 text-sm app-link min-h-11"
        >
          All games
        </Link>
        <BranchGameButton gamePk={game.gamePk} scheduleDate={scheduleDate} />
      </div>

      {/* Game header */}
      <div className="rounded-2xl border border-app app-surface-subtle px-4 sm:px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${
            isLive ? "text-red-600 dark:text-red-400" : isFinal ? "text-slate-600 dark:text-slate-400" : "text-amber-700 dark:text-amber-400"
          }`}>
            {game.detailedState}
          </span>
          <div className="flex items-center gap-2">
            {isLive && <PulsingDot />}
            {liveUpdatedStr && isLive && (
              <span className="text-[11px] text-app-dim font-mono">{liveUpdatedStr}</span>
            )}
          </div>
        </div>

        {/* Score board */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <div className="text-right min-w-0 flex-1">
            <p className="text-xs text-app-muted mb-1 truncate">{game.awayTeamName}</p>
            <ScorePill abbrev={awayAbbrev} score={game.awayScore} isWinner={awayWins} />
          </div>

          <div className="text-center px-2">
            {isLive && game.currentInning ? (
              <div className="space-y-1">
                <p className="text-base sm:text-lg font-mono text-app-secondary">
                  {formatInningShort(game.currentInningHalf, game.currentInning)}
                </p>
                {game.balls !== null && game.strikes !== null && (
                  <p className="text-xs font-mono text-app-muted">
                    {game.balls}-{game.strikes} · {game.outs} out{game.outs !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-app-dim font-mono text-base sm:text-lg">@</p>
            )}
          </div>

          <div className="text-left min-w-0 flex-1">
            <p className="text-xs text-app-muted mb-1 truncate">{game.homeTeamName}</p>
            <ScorePill abbrev={homeAbbrev} score={game.homeScore} isWinner={homeWins} />
          </div>
        </div>

        {/* Challenge counts */}
        {game.isTracked && (game.homeChallengesRemaining !== null || game.awayChallengesRemaining !== null) && (
          <div className="mt-4 pt-3 border-t border-app flex items-center justify-center gap-4 sm:gap-6">
            <ChallengeBar
              abbrev={awayAbbrev}
              remaining={game.awayChallengesRemaining}
              label="Away challenges"
            />
            <div className="h-6 w-px app-divider" />
            <ChallengeBar
              abbrev={homeAbbrev}
              remaining={game.homeChallengesRemaining}
              label="Home challenges"
            />
          </div>
        )}

        {/* Tracking badge */}
        {!game.isTracked && isFinal && (
          <p className="text-center text-xs text-amber-700/80 dark:text-amber-400/70 font-mono mt-4">
            Backfill pending — postgame analysis will appear once the pipeline ingests this game.
          </p>
        )}
        {!game.isTracked && !isFinal && (
          <p className="text-center text-xs text-app-faint font-mono mt-4">
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
            <div className="rounded-2xl border border-app app-surface-subtle px-4 sm:px-5 py-6 flex items-center gap-4">
              <PulsingDot />
              <p className="text-sm text-app-muted">Waiting for at-bat data…</p>
            </div>
          )}

          {livePitch ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs text-app-muted font-mono uppercase tracking-widest">Called Strike</p>
                <PulsingDot />
              </div>
              <LivePitchCard data={livePitch} />
            </section>
          ) : preBat ? (
            <div className="rounded-xl border border-app app-surface-subtle px-4 sm:px-5 py-4">
              <p className="text-sm text-app-secondary">No called strike yet this at-bat.</p>
            </div>
          ) : null}

          {pitcherChallengeHints ? (
            <PitcherChallengeHintsPanel hints={pitcherChallengeHints} />
          ) : null}

          {history && history.atBats.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-app-muted font-mono uppercase tracking-widest">At-bat history</p>
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
            <p className="text-xs text-app-muted font-mono uppercase tracking-widest">At-bat review</p>

          {historyLoading && !history && <HistoryRowSkeleton />}

          {!historyLoading && !history && game.isTracked && (
            <EmptyState title="No at-bat data found for this game." />
          )}

          {!historyLoading && !history && !game.isTracked && (
            <EmptyState
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
