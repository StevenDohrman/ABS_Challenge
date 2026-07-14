import { clampCount } from "../rules/runners";
import { OUTS_PER_HALF_INNING } from "../rules/inningProgression";

interface Props {
  balls: number;
  strikes: number;
  outs: number;
  onChange: (patch: { balls?: number; strikes?: number; outs?: number }) => void;
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-wider text-app-faint">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-11 w-11 rounded-lg border border-app-strong app-surface-muted text-sm text-app-secondary app-btn-icon"
          onClick={() => onChange(clampCount(value - 1, max))}
          disabled={value <= min}
        >
          −
        </button>
        <span className="w-8 text-center font-mono text-lg tabular-nums">{value}</span>
        <button
          type="button"
          className="h-11 w-11 rounded-lg border border-app-strong app-surface-muted text-sm text-app-secondary app-btn-icon"
          onClick={() => onChange(clampCount(value + 1, max))}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CountStrip({ balls, strikes, outs, onChange }: Props) {
  return (
    <div className="flex justify-around rounded-2xl border border-app app-surface-subtle px-4 py-4">
      <Stepper label="Balls" value={balls} min={0} max={3} onChange={(v) => onChange({ balls: v })} />
      <Stepper label="Strikes" value={strikes} min={0} max={2} onChange={(v) => onChange({ strikes: v })} />
      <Stepper
        label="Outs"
        value={outs}
        min={0}
        max={OUTS_PER_HALF_INNING}
        onChange={(v) => onChange({ outs: v })}
      />
    </div>
  );
}
