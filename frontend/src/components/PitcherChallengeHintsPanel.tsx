import type { PitcherChallengeHints } from "../api/types";

interface Props {
  hints: PitcherChallengeHints;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function PitcherChallengeHintsPanel({ hints }: Props) {
  const highlighted = hints.pitches.filter((pitch) => pitch.highlight);
  if (highlighted.length === 0) return null;

  const pitcherLabel = hints.pitcherName ?? `Pitcher ${hints.pitcherId}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-sky-500/20 bg-slate-900/80 shadow-lg">
      <div className="px-5 py-2.5 bg-sky-950/50 border-b border-sky-500/15 flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-widest text-sky-200/70">
          Pitcher challenge hints
        </span>
        <span className="ml-auto text-[11px] font-mono text-white/30">
          {pitcherLabel} · {hints.season}
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-white/75 leading-relaxed">{hints.summary}</p>

        <ul className="space-y-2">
          {highlighted.map((pitch) => (
            <li
              key={pitch.pitchType}
              className="rounded-xl border border-sky-500/15 bg-white/4 px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {pitch.pitchTypeName}
                </p>
                <p className="text-[11px] font-mono text-white/35 mt-0.5">
                  {pitch.pitchType} · {pitch.pitchCount} pitches ·{" "}
                  {formatPercent(pitch.usageRate)} usage
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold font-mono text-sky-300 tabular-nums">
                  {formatPercent(pitch.ballRate)}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-wide text-white/35">
                  ball rate
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-white/30 font-mono leading-relaxed">
          Season Statcast mix — coaching context only; does not change recommendations.
        </p>
      </div>
    </div>
  );
}
