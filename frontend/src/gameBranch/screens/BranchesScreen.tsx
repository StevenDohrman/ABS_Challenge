import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { BranchListCard } from "../components/BranchListCard";
import { ImportBranchPanel } from "../components/ImportBranchPanel";
import {
  listLocalBranches,
  localBranchCount,
  MAX_LOCAL_BRANCHES,
  removeLocalBranch,
  type BranchIndexEntry,
} from "../storage/localCache";

export function BranchesScreen() {
  const [branches, setBranches] = useState<BranchIndexEntry[]>(() => listLocalBranches());

  const refresh = useCallback(() => {
    setBranches(listLocalBranches());
  }, []);

  const handleDelete = (branchId: string) => {
    const entry = branches.find((b) => b.branchId === branchId);
    const label = entry
      ? `${entry.awayTeamAbbrev ?? "Away"} @ ${entry.homeTeamAbbrev ?? "Home"}`
      : "this branch";
    if (!window.confirm(`Remove ${label} from this browser? Your edits will be lost.`)) {
      return;
    }
    removeLocalBranch(branchId);
    refresh();
  };

  const count = localBranchCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your branches</h1>
        <p className="mt-1 text-sm text-white/45 leading-relaxed">
          Personal game sandboxes saved in this browser only — not synced across devices.
          Up to {MAX_LOCAL_BRANCHES} branches are kept; oldest are removed automatically.
        </p>
        {count > 0 && (
          <p className="mt-2 text-xs font-mono text-white/30">
            {count} of {MAX_LOCAL_BRANCHES} slots used
          </p>
        )}
      </div>

      <ImportBranchPanel onImported={refresh} />

      {branches.length === 0 ? (
        <EmptyState
          title="No saved branches yet"
          description="Branch a game from its detail page, or import an exported branch JSON above."
          size="md"
        >
          <Link
            to="/"
            className="inline-block mt-4 text-sm text-violet-300/90 hover:text-violet-200"
          >
            Browse games →
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {branches.map((entry) => (
            <li key={entry.branchId}>
              <BranchListCard entry={entry} onDelete={handleDelete} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-white/25 leading-relaxed">
        Branches also sync to the server while your session is active. After a server restart,
        open a branch here to restore it from local storage.
      </p>
    </div>
  );
}
