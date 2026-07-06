import type { AtBatRecommendationGridResponse } from "../api/types";
import { inningHalfArrow } from "../utils/baseballDisplay";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";
import { CountGrid } from "./CountGrid";

interface Props {
  data: AtBatRecommendationGridResponse;
  /** If truthy, show the count grid (expandable) */
  showGrid?: boolean;
  onToggleGrid?: () => void;
}

export function PreAtBatBanner({ data, showGrid, onToggleGrid }: Props) {
  const { hasHighValueOpportunity, bestCount, bestRecommendation, bestExpectedValue, summaryMessage } = data;

  const headerBg = hasHighValueOpportunity
    ? "from-emerald-900/60 to-slate-900 border-emerald-700/40"
    : "from-slate-800/80 to-slate-900 border-slate-700/40";

  const headerIcon = hasHighValueOpportunity ? "⚡" : "🛡";

  const inningLabel = data.inning
    ? `${inningHalfArrow(data.halfInning, true)} ${data.inning}`.trim()
    : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
      {/* Header strip */}
      <div
        className={`px-5 py-2 bg-gradient-to-r ${headerBg} border-b border-white/10 flex items-center gap-2`}
      >
        <span className="text-base">{headerIcon}</span>
        <span className="text-xs font-mono uppercase tracking-widest text-white/50">
          Pre At-Bat Assessment
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs font-mono text-white/30">
          {inningLabel && <span>{inningLabel}</span>}
          <span>At-bat #{data.atBatIndex}</span>
        </span>
      </div>

      {/* Body */}
      <div className={`bg-gradient-to-br ${headerBg} px-5 py-4 space-y-4`}>
        {/* Summary row */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-sm font-medium leading-snug">
              {summaryMessage}
            </p>
          </div>
          {bestRecommendation && bestCount && bestExpectedValue !== null && (
            <div className="flex items-center gap-2 shrink-0">
              <RecommendationBadge
                recommendation={bestRecommendation as "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY"}
                size="sm"
              />
              <span className="text-xs text-white/40 font-mono">{bestCount}</span>
              <ExpectedValuePill value={bestExpectedValue} size="sm" />
            </div>
          )}
        </div>

        {/* Toggle grid button */}
        <button
          onClick={onToggleGrid}
          className="text-xs text-white/40 hover:text-white/70 transition-colors font-mono flex items-center gap-1.5"
        >
          <span
            className={`inline-block transition-transform duration-200 ${showGrid ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          {showGrid ? "Hide" : "Show"} full count grid
        </button>

        {/* Expandable count grid */}
        {showGrid && data.recommendations.length > 0 && (
          <div className="pt-1 border-t border-white/10">
            <CountGrid recommendations={data.recommendations} />
          </div>
        )}
      </div>
    </div>
  );
}
