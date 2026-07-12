import { Link } from "react-router-dom";
import type { BranchDocument } from "../state/branchTypes";
import { BranchBadge } from "./BranchBadge";
import { formatInningShort, teamAbbrev } from "../../utils/baseballDisplay";
import { playerLabel } from "../state/branchTypes";

interface Props {
  doc: BranchDocument;
  scheduleDate?: string;
}

function ChallengePips({ remaining }: { remaining: number }) {
  return (
    <div className="flex gap-1">
      {[0, 1].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-sm border ${
            i < remaining
              ? "border-emerald-400/50 bg-emerald-500/70"
              : "border-white/10 bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

export function BranchHeader({ doc, scheduleDate }: Props) {
  const { schedule, situation } = doc;
  const awayAbbrev = teamAbbrev(schedule.awayTeamAbbrev, schedule.awayTeamName);
  const homeAbbrev = teamAbbrev(schedule.homeTeamAbbrev, schedule.homeTeamName);
  const half =
    situation.halfInning === "top" ? "Top" : "Bot";

  return (
    <div className="space-y-4">
      <Link
        to="/branches"
        className="text-sm text-white/40 transition-colors hover:text-white/80"
      >
        All branches
      </Link>

      <Link
        to={scheduleDate ? `/games/${doc.parentGamePk}?date=${scheduleDate}` : `/games/${doc.parentGamePk}`}
        className="flex items-center gap-2 text-sm text-white/35 transition-colors hover:text-white/70"
      >
        Canonical game
      </Link>

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <BranchBadge />
          <span className="text-[11px] font-mono text-white/30">
            Forked {new Date(doc.forkedAt).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-white/40">{awayAbbrev}</p>
            <p className="text-2xl font-bold font-mono tabular-nums">{situation.awayScore}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-mono text-white/60">
              {formatInningShort(half, situation.inning)}
            </p>
            <p className="text-xs font-mono text-white/40">
              {situation.balls}-{situation.strikes} · {situation.outs} out
              {situation.outs !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/40">{homeAbbrev}</p>
            <p className="text-2xl font-bold font-mono tabular-nums">{situation.homeScore}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-8 border-t border-white/10 pt-3 text-[10px] font-mono text-white/40">
          <div className="flex flex-col items-center gap-1">
            <span>{awayAbbrev} ch.</span>
            <ChallengePips remaining={situation.awayChallengesRemaining} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span>{homeAbbrev} ch.</span>
            <ChallengePips remaining={situation.homeChallengesRemaining} />
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-white/35">
          {playerLabel(doc.playerNames, situation.batterId)} vs{" "}
          {playerLabel(doc.playerNames, situation.pitcherId)}
        </p>
      </div>
    </div>
  );
}
