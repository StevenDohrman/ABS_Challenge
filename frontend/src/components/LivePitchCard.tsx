import type { ChallengeRecommendationResponse } from "../api/types";
import { inningHalfArrow } from "../utils/baseballDisplay";
import { formatTimestamp } from "../utils/format";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";
import { ScoreBar } from "./ScoreBar";

interface Props {
  data: ChallengeRecommendationResponse;
}

function InningIndicator({
  inning,
  halfInning,
}: {
  inning: number;
  halfInning: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-app-muted">
      <span>{inningHalfArrow(halfInning)}</span>
      <span>{inning}</span>
    </span>
  );
}

function CountDisplay({ count }: { count: string }) {
  const [balls, strikes] = count.split("-");
  return (
    <div className="flex items-baseline gap-1 font-mono">
      <span className="text-2xl sm:text-3xl font-bold text-app">{balls}</span>
      <span className="text-lg sm:text-xl text-app-muted">-</span>
      <span className="text-2xl sm:text-3xl font-bold text-app">{strikes}</span>
      <span className="text-xs text-app-muted ml-1">COUNT</span>
    </div>
  );
}

const URGENCY_RING: Record<string, string> = {
  AUTO_ALLOW: "ring-2 ring-emerald-500/50",
  ALLOW: "ring-1 ring-green-500/40",
  WARN: "ring-1 ring-amber-500/40",
  DENY: "",
};

export function LivePitchCard({ data }: Props) {
  const { recommendation, count, inning, halfInning, outs, baseState,
          expectedValue, score, minimumConfidenceThreshold,
          displayMessage, reasons, triggeredAt } = data;

  const ring = URGENCY_RING[recommendation] ?? "";
  const triggeredTime = formatTimestamp(new Date(triggeredAt));

  return (
    <div
      className={`rounded-2xl overflow-hidden app-surface-elevated border border-app shadow-lg ${ring}`}
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 app-surface-muted border-b border-app">
        <InningIndicator inning={inning} halfInning={halfInning} />
        <span className="text-xs font-mono text-app-muted">
          {outs} out{outs !== 1 ? "s" : ""}
        </span>
        <span className="text-xs font-mono text-app-muted">{baseState}</span>
        <span className="ml-auto text-[10px] text-app-dim font-mono">
          {triggeredTime}
        </span>
      </div>

      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <CountDisplay count={count} />
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2 sm:pt-1">
            <RecommendationBadge recommendation={recommendation} size="lg" />
            <ExpectedValuePill value={expectedValue} />
          </div>
        </div>

        <p className="text-app font-semibold text-sm sm:text-base leading-snug">
          {displayMessage}
        </p>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-app-muted">
            <span className="font-mono uppercase tracking-wide">Challenge score</span>
            <span className="font-mono">{Math.round(score)} / 100</span>
          </div>
          <ScoreBar score={score} />
        </div>

        <div className="rounded-lg app-surface-muted border border-app border-l-2 border-l-emerald-500/35 px-4 py-3">
          <p className="text-xs text-app-muted uppercase tracking-wide font-mono">
            Minimum confidence threshold
          </p>
          <p className="text-app font-semibold mt-0.5">
            {minimumConfidenceThreshold}% confidence required
          </p>
        </div>

        {reasons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-app-muted uppercase tracking-wide font-mono">
              Why
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-0.5">
              {reasons.map((reason, i) => (
                <li key={i} className="text-sm text-app-secondary">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
