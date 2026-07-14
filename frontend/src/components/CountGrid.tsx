import type { CountStateRecommendation, RecommendationLabel } from "../api/types";

interface Props {
  recommendations: CountStateRecommendation[];
  /** Highlight this count (e.g. the currently triggered pitch count) */
  activeCount?: string;
}

const TONE: Record<RecommendationLabel, string> = {
  AUTO_ALLOW:
    "bg-emerald-500/20 border-emerald-600/50 text-emerald-900 dark:bg-emerald-500/25 dark:border-emerald-500/60 dark:text-emerald-200",
  ALLOW:
    "bg-green-500/15 border-green-600/45 text-green-900 dark:bg-green-500/20 dark:border-green-500/50 dark:text-green-200",
  WARN:
    "bg-amber-500/15 border-amber-600/45 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-200",
  DENY:
    "bg-red-500/12 border-red-600/40 text-red-900 dark:bg-red-500/15 dark:border-red-500/40 dark:text-red-300",
};

const SHORT_LABEL: Record<RecommendationLabel, string> = {
  AUTO_ALLOW: "AUTO",
  ALLOW: "ALLOW",
  WARN: "WARN",
  DENY: "DENY",
};

const STRIKE_COLS = [0, 1, 2];
const BALL_ROWS = [0, 1, 2, 3];

export function CountGrid({ recommendations, activeCount }: Props) {
  const map = new Map(
    recommendations.map((r) => [`${r.balls}-${r.strikes}`, r])
  );

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[1.75rem_1fr_1fr_1fr] sm:grid-cols-[2rem_1fr_1fr_1fr] gap-1 sm:gap-1.5 text-center">
        <div />
        {STRIKE_COLS.map((s) => (
          <div key={s} className="text-[10px] sm:text-xs text-app-muted font-mono pb-1">
            {s}K
          </div>
        ))}
      </div>

      {/* Rows */}
      {BALL_ROWS.map((b) => (
        <div
          key={b}
          className="grid grid-cols-[1.75rem_1fr_1fr_1fr] sm:grid-cols-[2rem_1fr_1fr_1fr] gap-1 sm:gap-1.5 items-center"
        >
          <div className="text-[10px] sm:text-xs text-app-muted font-mono text-right pr-0.5 sm:pr-1">
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
                  className="h-12 sm:h-14 rounded-lg app-surface-muted border border-app"
                />
              );
            }

            const isMissed = !rec.challengeAvailable;

            return (
              <div
                key={s}
                title={
                  isMissed
                    ? `Out of challenges — would be ${rec.recommendation}`
                    : undefined
                }
                className={`relative h-12 sm:h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all
                  ${TONE[rec.recommendation]}
                  ${isMissed ? "opacity-40" : ""}
                  ${isActive ? "ring-2 ring-slate-400 dark:ring-white/60 scale-105 shadow-lg" : ""}
                `}
              >
                {isMissed && (
                  <span className="absolute top-0.5 right-0.5 sm:right-1 text-[7px] sm:text-[8px] font-mono uppercase tracking-wider text-app-secondary">
                    no chal
                  </span>
                )}
                <span className="text-[10px] sm:text-xs font-mono font-semibold tracking-widest">
                  {SHORT_LABEL[rec.recommendation]}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono opacity-75">
                  {rec.expectedValue >= 0 ? "+" : ""}
                  {rec.expectedValue.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 pt-2 text-[10px] sm:text-[11px] text-app-muted">
        <span>Columns = strikes before pitch</span>
        <span>Rows = balls before pitch</span>
        <span>Value = expected runs gained</span>
        <span>Dimmed = out of challenges (missed opportunity)</span>
      </div>
    </div>
  );
}
