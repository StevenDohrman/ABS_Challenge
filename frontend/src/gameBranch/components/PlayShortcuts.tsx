import type { PlayType } from "../rules/plays";

interface Props {
  onPlay: (play: PlayType) => void;
}

const PLAYS: { type: PlayType; label: string }[] = [
  { type: "single", label: "Single" },
  { type: "walk", label: "Walk" },
  { type: "strikeout", label: "K" },
  { type: "sac_fly", label: "Sac fly" },
];

export function PlayShortcuts({ onPlay }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
      <h3 className="text-sm font-semibold text-white/80 mb-2">Quick plays</h3>
      <div className="flex flex-wrap gap-2">
        {PLAYS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => onPlay(type)}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
