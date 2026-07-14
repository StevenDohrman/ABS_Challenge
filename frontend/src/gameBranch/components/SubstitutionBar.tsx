import type { BranchDocument, TeamBranchState } from "../state/branchTypes";
import { playerLabel } from "../state/branchTypes";
import {
  isBlowout,
  listReplacementOptions,
  selectionLabel,
  type SubSelection,
} from "../rules/substitutions";

interface Props {
  doc: BranchDocument;
  team: TeamBranchState;
  selection: SubSelection;
  onPick: (playerId: number) => void;
  onCancel: () => void;
}

function sourceTag(source: "bench" | "bullpen" | "lineup"): string {
  if (source === "bench") return "bench";
  if (source === "bullpen") return "bullpen";
  return "lineup";
}

export function SubstitutionBar({ doc, team, selection, onPick, onCancel }: Props) {
  const options = listReplacementOptions(team, selection, isBlowout(doc.situation));

  return (
    <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-violet-100/90 leading-relaxed">
          Replace{" "}
          <span className="font-medium text-app">
            {playerLabel(doc.playerNames, selection.playerId)}
          </span>{" "}
          <span className="text-violet-200/70">({selectionLabel(selection)})</span>
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-[10px] font-mono uppercase tracking-wide text-app-muted hover:text-app-secondary"
        >
          Cancel
        </button>
      </div>

      {options.length === 0 ? (
        <p className="text-[10px] text-app-muted">No eligible replacements available.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => (
            <button
              key={opt.playerId}
              type="button"
              disabled={opt.disabled}
              title={opt.reason}
              onClick={() => onPick(opt.playerId)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                opt.disabled
                  ? "cursor-not-allowed border-app-subtle app-surface-muted text-app-dim"
                  : opt.source === "bullpen"
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                    : "border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
              }`}
            >
              {playerLabel(doc.playerNames, opt.playerId)}
              <span className="ml-1 text-[9px] opacity-60">{sourceTag(opt.source)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Highlight classes for bench/bullpen chips when they are valid picks. */
export function replacementChipClass(
  canPick: boolean,
  hasSelection: boolean,
  source: "bench" | "bullpen"
): string {
  if (canPick) {
    return source === "bullpen"
      ? "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
      : "border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25";
  }
  if (hasSelection) {
    return "cursor-not-allowed border-app-subtle app-surface-muted text-app-dim";
  }
  return source === "bullpen"
    ? "border-sky-500/15 bg-sky-500/8 text-sky-200/70"
    : "border-app app-surface-muted text-app-muted";
}
