import { useState } from "react";
import type { GameAtBatHistoryResponse } from "../../api/types";
import { AtBatHistory } from "../../components/AtBatHistory";
import { DisclosureChevron } from "../../components/ui/DisclosureChevron";

interface Props {
  history?: GameAtBatHistoryResponse;
}

export function BranchHistoryPanel({ history }: Props) {
  const [open, setOpen] = useState(false);
  if (!history?.atBats.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm font-semibold text-white/80"
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          Fork-time at-bat history ({history.totalAtBats})
          <span className="ml-2 font-normal text-white/35">
            — includes canonical RE per count
          </span>
        </span>
        <DisclosureChevron open={open} />
      </button>
      {open && (
        <div className="mt-3 opacity-80 pointer-events-none">
          <AtBatHistory atBats={history.atBats} />
        </div>
      )}
    </div>
  );
}
