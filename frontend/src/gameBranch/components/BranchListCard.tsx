import { Link } from "react-router-dom";
import type { BranchIndexEntry } from "../storage/localCache";
import { BranchBadge } from "./BranchBadge";
import { formatInningShort, teamAbbrev } from "../../utils/baseballDisplay";

interface Props {
  entry: BranchIndexEntry;
  onDelete: (branchId: string) => void;
}

function branchHref(entry: BranchIndexEntry): string {
  const base = `/games/${entry.parentGamePk}/branch/${entry.branchId}`;
  return entry.officialDate ? `${base}?date=${entry.officialDate}` : base;
}

export function BranchListCard({ entry, onDelete }: Props) {
  const awayAbbrev = teamAbbrev(entry.awayTeamAbbrev ?? "", entry.awayTeamName ?? "Away");
  const homeAbbrev = teamAbbrev(entry.homeTeamAbbrev ?? "", entry.homeTeamName ?? "Home");
  const half = entry.halfInning === "top" ? "Top" : "Bot";

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <BranchBadge />
        <div className="text-right text-[10px] font-mono text-white/30 leading-relaxed">
          <p>Forked {new Date(entry.forkedAt).toLocaleDateString()}</p>
          <p>Opened {new Date(entry.lastAccessedAt).toLocaleString()}</p>
        </div>
      </div>

      <Link
        to={branchHref(entry)}
        className="block rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition-colors hover:border-violet-500/30 hover:bg-black/30"
      >
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-white/40">{awayAbbrev}</p>
            <p className="text-2xl font-bold font-mono tabular-nums">{entry.awayScore}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-mono text-white/60">
              {formatInningShort(half, entry.inning)}
            </p>
            {entry.officialDate && (
              <p className="text-[10px] text-white/30">{entry.officialDate}</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-white/40">{homeAbbrev}</p>
            <p className="text-2xl font-bold font-mono tabular-nums">{entry.homeScore}</p>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          to={branchHref(entry)}
          className="text-xs text-violet-300/90 hover:text-violet-200"
        >
          Continue editing →
        </Link>
        <button
          type="button"
          onClick={() => onDelete(entry.branchId)}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-white/40 hover:border-red-500/30 hover:text-red-300"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
