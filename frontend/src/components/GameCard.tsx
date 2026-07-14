import { Link } from "react-router-dom";
import type { ScheduleGame } from "../api/types";
import { formatInningShort, teamAbbrev } from "../utils/baseballDisplay";
import { formatScheduledTime } from "../utils/format";

interface Props {
  game: ScheduleGame;
  scheduleDate: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotCls: string; textCls: string; bgCls: string; border: string }
> = {
  "In Progress":       { label: "LIVE",       dotCls: "bg-red-500 animate-pulse dark:bg-red-400",     textCls: "text-red-700 dark:text-red-300",    bgCls: "bg-red-50 dark:bg-red-950/40",    border: "border-red-200 dark:border-red-800/50" },
  "Warmup":            { label: "WARMUP",      dotCls: "bg-amber-500 animate-pulse dark:bg-amber-400",   textCls: "text-amber-700 dark:text-amber-300",  bgCls: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800/40" },
  "Pre-Game":          { label: "PRE-GAME",    dotCls: "bg-amber-500 dark:bg-amber-400",                 textCls: "text-amber-700 dark:text-amber-300",  bgCls: "bg-slate-100 dark:bg-slate-800/60",  border: "border-slate-200 dark:border-slate-700/40" },
  "Manager challenge": { label: "CHALLENGE",   dotCls: "bg-orange-500 animate-pulse dark:bg-orange-400",  textCls: "text-orange-700 dark:text-orange-300", bgCls: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-700/40" },
  "Scheduled":         { label: "SCHEDULED",   dotCls: "bg-slate-400 dark:bg-slate-500",                 textCls: "text-slate-600 dark:text-slate-400",  bgCls: "bg-slate-50 dark:bg-slate-800/40",  border: "border-slate-200 dark:border-slate-700/30" },
  "Final":             { label: "FINAL",       dotCls: "bg-slate-400 dark:bg-slate-600",                 textCls: "text-slate-600 dark:text-slate-400",  bgCls: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700/25" },
  "Game Over":         { label: "FINAL",       dotCls: "bg-slate-400 dark:bg-slate-600",                 textCls: "text-slate-600 dark:text-slate-400",  bgCls: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700/25" },
  "Postponed":         { label: "POSTPONED",   dotCls: "bg-slate-400 dark:bg-slate-600",                 textCls: "text-slate-500 dark:text-slate-500",  bgCls: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700/25" },
  "Cancelled":         { label: "CANCELLED",   dotCls: "bg-slate-400 dark:bg-slate-600",                 textCls: "text-slate-500 dark:text-slate-500",  bgCls: "bg-slate-50 dark:bg-slate-800/30",  border: "border-slate-200 dark:border-slate-700/25" },
  "Delayed":           { label: "DELAYED",     dotCls: "bg-amber-600",                 textCls: "text-amber-700 dark:text-amber-400",  bgCls: "bg-slate-50 dark:bg-slate-800/40",  border: "border-amber-200 dark:border-amber-800/30" },
  "Suspended":         { label: "SUSPENDED",   dotCls: "bg-amber-600",                 textCls: "text-amber-700 dark:text-amber-400",  bgCls: "bg-slate-50 dark:bg-slate-800/40",  border: "border-amber-200 dark:border-amber-800/30" },
};

const DEFAULT_STATUS = {
  label: "UNKNOWN", dotCls: "bg-slate-400 dark:bg-slate-600", textCls: "text-slate-500",
  bgCls: "bg-slate-50 dark:bg-slate-800/30", border: "border-slate-200 dark:border-slate-700/25",
};

function statusCfg(detailedState: string) {
  return STATUS_CONFIG[detailedState] ?? DEFAULT_STATUS;
}

function ScoreRow({
  abbrev, name, score, isWinner,
}: { abbrev: string; name: string; score: number | null; isWinner?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${isWinner ? "text-app" : "text-app-secondary"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono font-bold text-base w-10 shrink-0">{abbrev}</span>
        <span className="text-xs truncate hidden sm:block opacity-60">{name}</span>
      </div>
      <span className={`font-mono text-xl font-bold tabular-nums w-8 text-right ${isWinner ? "text-app" : ""}`}>
        {score !== null ? score : "-"}
      </span>
    </div>
  );
}

function LiveSituation({ game }: { game: ScheduleGame }) {
  if (game.abstractState !== "Live") return null;
  const { currentInning, currentInningHalf, balls, strikes, outs } = game;
  return (
    <div className="mt-3 pt-3 border-t border-app flex items-center gap-3 text-xs font-mono text-app-muted">
      <span>{formatInningShort(currentInningHalf, currentInning)}</span>
      {balls !== null && strikes !== null && (
        <span>{balls}-{strikes}</span>
      )}
      {outs !== null && (
        <span>{outs} out{outs !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
}

function ChallengeChip({ abbrev, remaining }: { abbrev: string; remaining: number }) {
  const isEmpty = remaining === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
        isEmpty
          ? "text-red-700 bg-red-500/10 border-red-500/25 dark:text-red-400/70 dark:bg-red-500/10 dark:border-red-500/20"
          : "text-app-muted app-surface-muted border-app"
      }`}
    >
      {abbrev} {remaining}
    </span>
  );
}

function ChallengeCounts({ game }: { game: ScheduleGame }) {
  if (!game.isTracked) return null;
  if (game.homeChallengesRemaining === null && game.awayChallengesRemaining === null) return null;

  const awayAbbrev = teamAbbrev(game.awayTeamAbbrev, game.awayTeamName);
  const homeAbbrev = teamAbbrev(game.homeTeamAbbrev, game.homeTeamName);

  return (
    <div className="mt-2.5 pt-2.5 border-t border-app flex items-center gap-1.5">
      <span className="text-[10px] font-mono text-app-faint mr-0.5">Challenges</span>
      {game.awayChallengesRemaining !== null && (
        <ChallengeChip abbrev={awayAbbrev} remaining={game.awayChallengesRemaining} />
      )}
      {game.homeChallengesRemaining !== null && (
        <ChallengeChip abbrev={homeAbbrev} remaining={game.homeChallengesRemaining} />
      )}
    </div>
  );
}

export function GameCard({ game, scheduleDate }: Props) {
  const cfg = statusCfg(game.detailedState);
  const isLive = game.abstractState === "Live";
  const isFinal = game.abstractState === "Final";
  const hasScore = game.homeScore !== null || game.awayScore !== null;

  const homeWins = hasScore && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const awayWins = hasScore && (game.awayScore ?? 0) > (game.homeScore ?? 0);

  return (
    <Link
      to={`/games/${game.gamePk}?date=${scheduleDate}`}
      className={`block w-full text-left rounded-2xl border p-4 transition-all duration-150
        hover:scale-[1.01] hover:brightness-105 dark:hover:brightness-110 active:scale-[0.99]
        ${cfg.bgCls} ${cfg.border}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold ${cfg.textCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
          {cfg.label}
        </span>
        <div className="flex items-center gap-2">
          {game.hasTriggeredRecommendation && (
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/25">
              REC
            </span>
          )}
          {game.isTracked && !game.hasTriggeredRecommendation && (
            <span className="text-[10px] font-mono text-slate-500 app-surface-muted border border-app px-1.5 py-0.5 rounded">
              TRACKED
            </span>
          )}
          {!isLive && !isFinal && (
            <span className="text-xs text-app-faint font-mono">
              {formatScheduledTime(game.scheduledStartTime)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <ScoreRow
          abbrev={teamAbbrev(game.awayTeamAbbrev, game.awayTeamName)}
          name={game.awayTeamName}
          score={game.awayScore}
          isWinner={awayWins}
        />
        <ScoreRow
          abbrev={teamAbbrev(game.homeTeamAbbrev, game.homeTeamName)}
          name={game.homeTeamName}
          score={game.homeScore}
          isWinner={homeWins}
        />
      </div>

      <LiveSituation game={game} />
      <ChallengeCounts game={game} />
    </Link>
  );
}
