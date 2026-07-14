import type { AtBatRecommendationGridResponse } from "../api/types";
import { inningHalfArrow } from "../utils/baseballDisplay";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";
import { CountGrid } from "./CountGrid";
import { DisclosureChevron } from "./ui/DisclosureChevron";

interface Props {
  data: AtBatRecommendationGridResponse;
  showGrid?: boolean;
  onToggleGrid?: () => void;
}

export function PreAtBatBanner({ data, showGrid, onToggleGrid }: Props) {
  const { hasHighValueOpportunity, bestCount, bestRecommendation, bestExpectedValue, summaryMessage } = data;

  const headerBg = hasHighValueOpportunity
    ? "from-emerald-100 to-slate-100 border-emerald-300/60 dark:from-emerald-900/60 dark:to-slate-900 dark:border-emerald-700/40"
    : "from-slate-100 to-slate-50 border-slate-300/60 dark:from-slate-800/80 dark:to-slate-900 dark:border-slate-700/40";

  const inningLabel = data.inning
    ? `${inningHalfArrow(data.halfInning, true)} ${data.inning}`.trim()
    : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-app shadow-md dark:shadow-xl">
      <div
        className={`px-4 sm:px-5 py-2 bg-gradient-to-r ${headerBg} border-b border-app flex flex-wrap items-center gap-2`}
      >
        <span className="text-xs font-mono uppercase tracking-widest text-app-muted">
          Pre At-Bat Assessment
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs font-mono text-app-faint">
          {inningLabel && <span>{inningLabel}</span>}
          <span>At-bat #{data.atBatIndex}</span>
        </span>
      </div>

      <div className={`bg-gradient-to-br ${headerBg} px-4 sm:px-5 py-4 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-app text-sm font-medium leading-snug">
              {summaryMessage}
            </p>
          </div>
          {bestRecommendation && bestCount && bestExpectedValue !== null && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <RecommendationBadge
                recommendation={bestRecommendation as "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY"}
                size="sm"
              />
              <span className="text-xs text-app-muted font-mono">{bestCount}</span>
              <ExpectedValuePill value={bestExpectedValue} size="sm" />
            </div>
          )}
        </div>

        <button
          onClick={onToggleGrid}
          className="text-xs text-app-muted hover:text-app-secondary transition-colors font-mono flex items-center gap-1.5 min-h-11"
        >
          <DisclosureChevron open={!!showGrid} />
          {showGrid ? "Hide" : "Show"} full count grid
        </button>

        {showGrid && data.recommendations.length > 0 && (
          <div className="pt-1 border-t border-app">
            <CountGrid recommendations={data.recommendations} />
          </div>
        )}
      </div>
    </div>
  );
}
