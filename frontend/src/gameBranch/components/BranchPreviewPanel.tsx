import type { AtBatRecommendationGridResponse } from "../../api/types";
import { CountGrid } from "../../components/CountGrid";
import { RecommendationBadge } from "../../components/RecommendationBadge";
import { ExpectedValuePill } from "../../components/ExpectedValuePill";

interface Props {
  grid: AtBatRecommendationGridResponse;
  computedAt?: string;
}

/** Current-situation engine preview with expected run values (not persisted to DB). */
export function BranchPreviewPanel({ grid, computedAt }: Props) {
  const rec = grid.bestRecommendation as
    | "AUTO_ALLOW"
    | "ALLOW"
    | "WARN"
    | "DENY"
    | null;

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/80">Current situation — challenge value</h3>
        {computedAt && (
          <span className="text-[10px] font-mono text-white/30">
            {new Date(computedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      <p className="text-xs text-white/45 leading-relaxed">
        Expected run (RE) values for the edited count, base state, and lineup — recomputed from
        your branch, not saved to the database.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {rec && grid.bestCount && (
          <>
            <span className="text-xs font-mono text-white/40">{grid.bestCount}</span>
            <RecommendationBadge recommendation={rec} size="sm" />
            {grid.bestExpectedValue != null && (
              <ExpectedValuePill value={grid.bestExpectedValue} size="sm" />
            )}
          </>
        )}
      </div>
      <p className="text-xs text-white/40">{grid.summaryMessage}</p>
      <CountGrid recommendations={grid.recommendations} />
    </div>
  );
}
