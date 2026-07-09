import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { importBranchDocument } from "../api/branchClient";
import { validateBranchImport } from "../state/branchTypes";
import { writeLocalBranch } from "../storage/localCache";

interface Props {
  onImported?: () => void;
}

export function ImportBranchPanel({ onImported }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setError(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!validateBranchImport(parsed)) {
        setError("Invalid branch JSON — missing required fields or schema version.");
        return;
      }

      const result = await importBranchDocument(parsed);
      if (result.status !== "ok") {
        setError(result.status === "error" ? result.message : "Import failed");
        return;
      }

      const doc = result.data.branch;
      writeLocalBranch(doc);
      onImported?.();

      const qs = doc.schedule.officialDate ? `?date=${doc.schedule.officialDate}` : "";
      navigate(`/games/${doc.parentGamePk}/branch/${doc.branchId}${qs}`);
    } catch {
      setError("Could not parse JSON.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/80">Import a branch</h2>
          <p className="mt-1 text-xs text-white/40 leading-relaxed">
            Load a previously exported <span className="font-mono">.abs-branch.json</span> file.
            This creates a new branch session from the snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          {open ? "Hide" : "Import JSON"}
        </button>
      </div>

      {open && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste exported branch JSON…"
            className="h-36 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/80"
          />
          {error && <p className="text-xs text-red-300/90">{error}</p>}
          <button
            type="button"
            disabled={loading || text.trim().length === 0}
            onClick={() => void handleImport()}
            className="rounded-lg bg-violet-600/80 px-4 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
          >
            {loading ? "Importing…" : "Load branch"}
          </button>
        </div>
      )}
    </div>
  );
}
