import type { ReactNode } from "react";
import {
  buildScheduleDateOptionsOldestFirst,
  formatScheduleDateSquare,
  goToNewerDay,
  goToOlderDay,
} from "../utils/scheduleDates";

interface Props {
  daysAgo: number;
  onChange: (daysAgo: number) => void;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function ScheduleDateSlider({ daysAgo, onChange }: Props) {
  const options = buildScheduleDateOptionsOldestFirst();

  return (
    <div className="rounded-xl border border-app app-surface-subtle px-3 py-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-app-faint mb-2.5 px-1">
        Game date
      </p>

      <div className="flex items-stretch gap-2">
        <NavButton
          ariaLabel="Older date"
          onClick={() => onChange(goToOlderDay(daysAgo))}
        >
          <ChevronLeft />
        </NavButton>

        <div className="flex flex-1 items-stretch justify-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none">
          {options.map((option) => {
            const selected = option.daysAgo === daysAgo;
            const { primary, secondary } = formatScheduleDateSquare(option);

            return (
              <button
                key={option.date}
                type="button"
                onClick={() => onChange(option.daysAgo)}
                aria-label={option.longLabel}
                aria-pressed={selected}
                className={[
                  "flex min-w-[3.25rem] min-h-11 shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-2 transition-colors",
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-900 shadow-sm dark:border-emerald-400/70 dark:bg-emerald-500/15 dark:text-white dark:shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
                    : "border-app app-surface-subtle text-app-secondary hover:border-slate-300 hover:bg-slate-100 hover:text-app dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-app",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[10px] font-mono font-semibold leading-none tracking-wide",
                    selected ? "text-emerald-800 dark:text-emerald-200" : "",
                  ].join(" ")}
                >
                  {primary}
                </span>
                <span className="mt-1 text-lg font-bold font-mono leading-none tabular-nums">
                  {secondary}
                </span>
              </button>
            );
          })}
        </div>

        <NavButton
          ariaLabel="Newer date"
          onClick={() => onChange(goToNewerDay(daysAgo))}
        >
          <ChevronRight />
        </NavButton>
      </div>

      <p className="mt-2.5 px-1 text-[11px] text-app-dim leading-relaxed">
        Past dates on the left, today on the right. Arrows move one day at a time (wraps at the ends).
      </p>
    </div>
  );
}

function NavButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-app-strong app-surface-muted text-app-muted transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-app dark:hover:border-white/25 dark:hover:bg-white/[0.08] dark:hover:text-app"
    >
      {children}
    </button>
  );
}
