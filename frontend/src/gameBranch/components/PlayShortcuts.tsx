import type { BranchSituation } from "../state/branchTypes";
import { availablePlays, type PlayType } from "../rules/plays";

interface Props {
  situation: BranchSituation;
  onPlay: (play: PlayType) => void;
}

const PLAY_LABELS: Record<PlayType, string> = {
  walk: "Walk",
  single: "Single",
  double: "Double",
  home_run: "HR",
  strikeout: "K",
  out: "Out",
  sac_fly: "Sac fly",
  double_play: "Double play",
};

export function PlayShortcuts({ situation, onPlay }: Props) {
  const plays = availablePlays(situation);

  return (
    <div className="rounded-2xl border border-app app-surface-subtle p-4">
      <h3 className="text-sm font-semibold text-app mb-2">Quick plays</h3>
      <p className="mb-3 text-[10px] text-app-faint leading-relaxed">
        Sac fly (runner on 3rd, &lt; 2 outs) and double play (runner on, &lt; 2 outs) appear
        only when the situation allows.
      </p>
      <div className="flex flex-wrap gap-2">
        {plays.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onPlay(type)}
            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 min-h-11 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
          >
            {PLAY_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
