import { useState } from "react";
import type { BranchDocument, BranchSide } from "../state/branchTypes";
import { playerLabel } from "../state/branchTypes";
import { teamAbbrev } from "../../utils/baseballDisplay";
import { isBlowout, listReplacementOptions } from "../rules/substitutions";
import { SubstitutionBar, replacementChipClass } from "./SubstitutionBar";

interface Props {
  doc: BranchDocument;
  side: BranchSide;
  onSwap: (slotIndex: number, benchPlayerId: number) => void;
}

export function LineupPanel({ doc, side, onSwap }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const team = doc.teams[side];
  const abbrev =
    side === "home"
      ? teamAbbrev(doc.schedule.homeTeamAbbrev, doc.schedule.homeTeamName)
      : teamAbbrev(doc.schedule.awayTeamAbbrev, doc.schedule.awayTeamName);

  const selection =
    selectedSlot != null && team.battingOrder[selectedSlot] != null
      ? {
          kind: "lineup" as const,
          slotIndex: selectedSlot,
          playerId: team.battingOrder[selectedSlot]!,
        }
      : null;

  const options = selection
    ? listReplacementOptions(team, selection, isBlowout(doc.situation))
    : [];

  const applySwap = (benchPlayerId: number) => {
    if (selectedSlot == null) return;
    onSwap(selectedSlot, benchPlayerId);
    setSelectedSlot(null);
  };

  return (
    <div className="rounded-2xl border border-app app-surface-subtle p-4 space-y-3">
      <h3 className="text-sm font-semibold text-app">{abbrev} lineup</h3>
      <p className="text-[10px] text-app-faint leading-relaxed">
        Tap who is leaving the lineup, then pick a bench player to pinch-hit (offense only).
      </p>

      {selection && (
        <SubstitutionBar
          doc={doc}
          team={team}
          selection={selection}
          onPick={applySwap}
          onCancel={() => setSelectedSlot(null)}
        />
      )}

      <ol className="space-y-1">
        {team.battingOrder.map((id, i) => {
          const isSelected = selectedSlot === i;
          const isUp = doc.situation.batterId === id;
          return (
            <li key={`${id}-${i}`}>
              <button
                type="button"
                onClick={() => setSelectedSlot(isSelected ? null : i)}
                className={`flex w-full items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? "border border-violet-500/50 bg-violet-500/20 ring-1 ring-violet-500/20"
                    : "border border-transparent bg-black/20 hover:border-app-strong hover:bg-black/30"
                }`}
              >
                <span className="font-mono text-app-faint w-5">{i + 1}</span>
                <span className="flex-1 truncate text-left">
                  {playerLabel(doc.playerNames, id)}
                  {isUp && <span className="ml-1 text-[10px] text-emerald-400">↑ batting</span>}
                </span>
              </button>
            </li>
          );
        })}
        {team.battingOrder.length === 0 && (
          <li className="text-xs text-app-faint">No lineup slots yet</li>
        )}
      </ol>

      {team.bench.length === 0 ? (
        <p className="text-xs text-amber-300/70 leading-relaxed">
          No bench players loaded — start a fresh branch after the backend restarts to pull the
          latest roster from MLB.
        </p>
      ) : (
        <div>
          <p className="text-[10px] font-mono uppercase text-app-faint mb-1">Bench</p>
          <div className="flex flex-wrap gap-1.5">
            {team.bench.map((id) => {
              const opt = options.find((o) => o.playerId === id);
              const canPick = !!opt && !opt.disabled;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!selection || !canPick}
                  title={opt?.reason}
                  onClick={() => canPick && applySwap(id)}
                  className={`rounded-lg border px-2 py-1 text-xs transition-colors ${replacementChipClass(
                    canPick,
                    !!selection,
                    "bench"
                  )}`}
                >
                  {playerLabel(doc.playerNames, id)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
