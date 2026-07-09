import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBranchOnce } from "../gameBranch/api/branchClient";
import { useBranchEligibility } from "../gameBranch/hooks/useBranchEligibility";
import { writeLocalBranch } from "../gameBranch/storage/localCache";

interface Props {
  gamePk: number;
  scheduleDate?: string;
}

export function BranchGameButton({ gamePk, scheduleDate }: Props) {
  const { eligibility, loading } = useBranchEligibility(gamePk);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleBranch() {
    if (creating) return;
    setCreating(true);
    setCreateError(null);

    const result = await createBranchOnce(gamePk);
    if (result.status === "ok") {
      writeLocalBranch(result.data.branch);
      const qs = scheduleDate ? `?date=${scheduleDate}` : "";
      navigate(`/games/${gamePk}/branch/${result.data.branchId}${qs}`);
      return;
    }

    setCreateError(
      result.status === "error"
        ? result.message
        : "Failed to create branch — rosters may not be published yet"
    );
    setCreating(false);
  }

  if (loading) {
    return (
      <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/30">
        Branch…
      </span>
    );
  }

  if (eligibility?.eligible) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          title={eligibility.reason}
          disabled={creating}
          onClick={() => void handleBranch()}
          className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
        >
          {creating ? "Branching…" : "Branch game"}
        </button>
        {createError && (
          <span className="max-w-[12rem] text-right text-[10px] text-red-300/90">
            {createError}
          </span>
        )}
      </div>
    );
  }

  const reason =
    eligibility?.reason ??
    "Rosters not published yet — usually available at warmup.";

  return (
    <span
      title={reason}
      className="cursor-not-allowed rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/30"
    >
      Branch game
    </span>
  );
}
