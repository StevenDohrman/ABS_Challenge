import { buildScheduleDateOptions } from "../utils/scheduleDates";

interface Props {
  daysAgo: number;
  onChange: (daysAgo: number) => void;
}

export function ScheduleDateSlider({ daysAgo, onChange }: Props) {
  const options = buildScheduleDateOptions();
  const selected = options[daysAgo] ?? options[0];
  const maxDaysAgo = options.length - 1;

  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/40">
            Game date
          </p>
          <p className="text-sm font-medium text-white/90 mt-0.5">{selected.longLabel}</p>
        </div>
        <p className="text-[11px] text-white/30 font-mono shrink-0 pt-0.5">
          {selected.date}
        </p>
      </div>

      <input
        type="range"
        min={0}
        max={maxDaysAgo}
        step={1}
        value={daysAgo}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          bg-white/10 accent-emerald-400
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-emerald-400
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-slate-950
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-emerald-400
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-slate-950"
        aria-label="Select schedule date"
      />

      <div className="flex justify-between gap-1 text-[10px] font-mono text-white/30">
        <span className={daysAgo === 0 ? "text-emerald-400/90" : ""}>Today</span>
        <span className={daysAgo === maxDaysAgo ? "text-emerald-400/90" : ""}>
          {options[maxDaysAgo]?.shortLabel}
        </span>
      </div>

      <p className="text-[11px] text-white/25 leading-relaxed">
        Postgame Savant audit runs ~14 hours after final — slide back to review completed games.
      </p>
    </div>
  );
}
