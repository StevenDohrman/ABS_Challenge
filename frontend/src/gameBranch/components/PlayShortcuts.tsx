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
    <div className="rounded-2xl border border-app app-surface-subtle p-4">
      <h3 className="text-sm font-semibold text-app mb-2">Quick plays</h3>
      <div className="flex flex-wrap gap-2">
        {PLAYS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => onPlay(type)}
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 min-h-11 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
