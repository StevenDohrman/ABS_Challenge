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
    <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2.5 px-1">
        Game date
      </p>

      <div className="flex items-stretch gap-2">
        <NavButton
          ariaLabel="Older date"
          onClick={() => onChange(goToOlderDay(daysAgo))}
        >
          <ChevronLeft />
        </NavButton>

        <div className="flex flex-1 items-stretch justify-center gap-1.5 min-w-0 overflow-x-auto">
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
                  "flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-2 transition-colors",
                  selected
                    ? "border-emerald-400/70 bg-emerald-500/15 text-white shadow-[0_0_0_1px_rgba(52,211,153,0.25)]"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[10px] font-mono font-semibold leading-none tracking-wide",
                    selected ? "text-emerald-200" : "",
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

      <p className="mt-2.5 px-1 text-[11px] text-white/25 leading-relaxed">
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
      className="flex h-auto w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/50 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white/90"
    >
      {children}
    </button>
  );
}
