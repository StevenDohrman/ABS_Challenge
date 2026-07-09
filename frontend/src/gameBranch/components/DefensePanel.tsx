import { useState } from "react";
import type { BranchDocument, BranchSide, DefensiveLineup } from "../state/branchTypes";
import { playerLabel } from "../state/branchTypes";
import { isBlowout, listReplacementOptions } from "../rules/substitutions";
import { SubstitutionBar, replacementChipClass } from "./SubstitutionBar";

const SLOTS: { key: keyof DefensiveLineup; label: string }[] = [
  { key: "pitcher", label: "P" },
  { key: "catcher", label: "C" },
  { key: "first", label: "1B" },
  { key: "second", label: "2B" },
  { key: "shortstop", label: "SS" },
  { key: "third", label: "3B" },
  { key: "left", label: "LF" },
  { key: "center", label: "CF" },
  { key: "right", label: "RF" },
];

interface Props {
  doc: BranchDocument;
  side: BranchSide;
  onAssign: (slot: keyof DefensiveLineup, playerId: number) => void;
}

export function DefensePanel({ doc, side, onAssign }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<keyof DefensiveLineup | null>(null);
  const team = doc.teams[side];
  const blowout = isBlowout(doc.situation);
  const abbrev =
    side === "home"
      ? doc.schedule.homeTeamAbbrev || doc.schedule.homeTeamName.slice(0, 3)
      : doc.schedule.awayTeamAbbrev || doc.schedule.awayTeamName.slice(0, 3);

  const selection =
    selectedSlot != null && team.defense[selectedSlot] != null
      ? {
          kind: "defense" as const,
          slot: selectedSlot,
          playerId: team.defense[selectedSlot]!,
        }
      : null;

  const options = selection
    ? listReplacementOptions(team, selection, isBlowout(doc.situation))
    : [];

  const applySwap = (playerId: number) => {
    if (!selectedSlot) return;
    onAssign(selectedSlot, playerId);
    setSelectedSlot(null);
  };

  const poolIds = new Set(options.filter((o) => !o.disabled).map((o) => o.playerId));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white/80">{abbrev} defense</h3>
      <p className="text-[10px] text-white/30 leading-relaxed">
        Tap a position, then pick a bench replacement (also takes over their lineup spot). Use P
        for bullpen pitchers{blowout ? " — position players can pitch in a blowout" : ""}.
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

      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map(({ key, label }) => {
          const id = team.defense[key];
          const isSelected = selectedSlot === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!id}
              onClick={() => id && setSelectedSlot(isSelected ? null : key)}
              className={`rounded-lg px-2 py-2 text-left transition-colors ${
                isSelected
                  ? "border border-emerald-500/50 bg-emerald-500/15 ring-1 ring-emerald-500/20"
                  : "border border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
              } ${!id ? "opacity-40" : ""}`}
            >
              <span className="text-[10px] font-mono text-white/35">{label}</span>
              <p className="text-xs truncate text-white/75">
                {id ? playerLabel(doc.playerNames, id) : "—"}
              </p>
            </button>
          );
        })}
      </div>

      {selection && selectedSlot !== "pitcher" && team.bench.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase text-white/35 mb-1">Bench</p>
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

      {selection && selectedSlot === "pitcher" && team.bullpen.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase text-white/35 mb-1">Bullpen</p>
            <div className="flex flex-wrap gap-1.5">
              {team.bullpen.map((id) => {
                const opt = options.find((o) => o.playerId === id);
                const canPick = !!opt && !opt.disabled;
                const highlighted = poolIds.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!canPick}
                    title={opt?.reason}
                    onClick={() => canPick && applySwap(id)}
                    className={`rounded-lg border px-2 py-1 text-xs transition-colors ${replacementChipClass(
                      canPick,
                      highlighted,
                      "bullpen"
                    )}`}
                  >
                    {playerLabel(doc.playerNames, id)}
                  </button>
                );
              })}
            </div>
        </div>
      )}

      {selection && blowout && selectedSlot === "pitcher" && team.bench.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase text-white/35 mb-1">
            Bench (position players — blowout pitching)
          </p>
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
