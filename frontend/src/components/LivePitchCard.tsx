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
    <span className="inline-flex items-center gap-1 text-xs font-mono text-white/50">
      <span>{inningHalfArrow(halfInning)}</span>
      <span>{inning}</span>
    </span>
  );
}

function CountDisplay({ count }: { count: string }) {
  const [balls, strikes] = count.split("-");
  return (
    <div className="flex items-baseline gap-1 font-mono">
      <span className="text-3xl font-bold text-white">{balls}</span>
      <span className="text-xl text-white/40">-</span>
      <span className="text-3xl font-bold text-white">{strikes}</span>
      <span className="text-xs text-white/40 ml-1">COUNT</span>
    </div>
  );
}

const URGENCY_RING: Record<string, string> = {
  AUTO_ALLOW: "ring-2 ring-emerald-500/50",
  ALLOW:      "ring-1 ring-green-500/40",
  WARN:       "ring-1 ring-amber-500/40",
  DENY:       "",
};

export function LivePitchCard({ data }: Props) {
  const { recommendation, count, inning, halfInning, outs, baseState,
          expectedValue, score, minimumConfidenceThreshold,
          displayMessage, reasons, triggeredAt } = data;

  const ring = URGENCY_RING[recommendation] ?? "";

  const triggeredTime = formatTimestamp(new Date(triggeredAt));

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl ${ring}`}
    >
      {/* Top bar — game situation */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white/5 border-b border-white/10">
        <InningIndicator inning={inning} halfInning={halfInning} />
        <span className="text-xs font-mono text-white/40">
          {outs} out{outs !== 1 ? "s" : ""}
        </span>
        <span className="text-xs font-mono text-white/40">{baseState}</span>
        <span className="ml-auto text-[10px] text-white/25 font-mono">
          {triggeredTime}
        </span>
      </div>

      {/* Main content */}
      <div className="px-5 py-5 space-y-5">
        {/* Count + badge row */}
        <div className="flex items-start justify-between gap-4">
          <CountDisplay count={count} />
          <div className="flex flex-col items-end gap-2 pt-1">
            <RecommendationBadge recommendation={recommendation} size="lg" />
            <ExpectedValuePill value={expectedValue} />
          </div>
        </div>

        {/* Display message */}
        <p className="text-white font-semibold text-base leading-snug">
          {displayMessage}
        </p>

        {/* Score bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/40">
            <span className="font-mono uppercase tracking-wide">Challenge score</span>
            <span className="font-mono">{Math.round(score)} / 100</span>
          </div>
          <ScoreBar score={score} />
        </div>

        {/* Confidence note */}
        <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide font-mono">
              Minimum confidence threshold
            </p>
            <p className="text-white font-semibold">
              {minimumConfidenceThreshold}% confidence required
            </p>
          </div>
        </div>

        {/* Engine reasons */}
        {reasons.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-white/40 uppercase tracking-wide font-mono">
              Why
            </p>
            <ul className="space-y-1.5">
              {reasons.map((reason, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-white/75"
                >
                  <span className="mt-0.5 text-white/25">›</span>
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
