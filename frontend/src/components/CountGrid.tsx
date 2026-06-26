import type { CountStateRecommendation, RecommendationLabel } from "../api/types";

interface Props {
  recommendations: CountStateRecommendation[];
  /** Highlight this count (e.g. the currently triggered pitch count) */
  activeCount?: string;
}

const TONE: Record<RecommendationLabel, string> = {
  AUTO_ALLOW: "bg-emerald-500/25 border-emerald-500/60 text-emerald-200",
  ALLOW:      "bg-green-500/20 border-green-500/50 text-green-200",
  WARN:       "bg-amber-500/20 border-amber-500/50 text-amber-200",
  DENY:       "bg-red-500/15 border-red-500/40 text-red-300",
};

const SHORT_LABEL: Record<RecommendationLabel, string> = {
  AUTO_ALLOW: "AUTO",
  ALLOW:      "ALLOW",
  WARN:       "WARN",
  DENY:       "DENY",
};

const STRIKE_COLS = [0, 1, 2];
const BALL_ROWS   = [0, 1, 2, 3];

export function CountGrid({ recommendations, activeCount }: Props) {
  const map = new Map(
    recommendations.map((r) => [`${r.balls}-${r.strikes}`, r])
  );

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-1.5 text-center">
        <div />
        {STRIKE_COLS.map((s) => (
          <div key={s} className="text-xs text-white/40 font-mono pb-1">
            {s}K
          </div>
        ))}
      </div>

      {/* Rows */}
      {BALL_ROWS.map((b) => (
        <div
          key={b}
          className="grid grid-cols-[2rem_1fr_1fr_1fr] gap-1.5 items-center"
        >
          <div className="text-xs text-white/40 font-mono text-right pr-1">
            {b}B
          </div>
          {STRIKE_COLS.map((s) => {
            const key = `${b}-${s}`;
            const rec = map.get(key);
            const isActive = activeCount === key;

            if (!rec) {
              return (
                <div
                  key={s}
                  className="h-14 rounded-lg bg-white/5 border border-white/10"
                />
              );
            }

            // Out of challenges: the value-based recommendation still shows, but
            // the cell is dimmed and flagged so a high-value call reads as a
            // missed opportunity rather than an action to take.
            const isMissed = !rec.challengeAvailable;

            return (
              <div
                key={s}
                title={
                  isMissed
                    ? `Out of challenges — would be ${rec.recommendation}`
                    : undefined
                }
                className={`relative h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all
                  ${TONE[rec.recommendation]}
                  ${isMissed ? "opacity-40" : ""}
                  ${isActive ? "ring-2 ring-white/60 scale-105 shadow-lg" : ""}
                `}
              >
                {isMissed && (
                  <span className="absolute top-0.5 right-1 text-[8px] font-mono uppercase tracking-wider text-white/70">
                    no chal
                  </span>
                )}
                <span className="text-xs font-mono font-semibold tracking-widest">
                  {SHORT_LABEL[rec.recommendation]}
                </span>
                <span className="text-[10px] font-mono opacity-75">
                  {rec.expectedValue >= 0 ? "+" : ""}
                  {rec.expectedValue.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[11px] text-white/40">
        <span>Columns = strikes before pitch</span>
        <span>Rows = balls before pitch</span>
        <span>Value = expected runs gained</span>
        <span>Dimmed = out of challenges (missed opportunity)</span>
      </div>
    </div>
  );
}
