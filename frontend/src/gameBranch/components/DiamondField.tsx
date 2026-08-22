import { useEffect, useState } from "react";
import type { BranchRunners } from "../state/branchTypes";
import { playerLabel } from "../state/branchTypes";

export interface RunnerOption {
  playerId: number;
  disabled?: boolean;
  reason?: string;
}

interface Props {
  runners: BranchRunners;
  playerNames: Record<number, string>;
  getBenchOptions: (outgoingId: number) => RunnerOption[];
  placeOptions: RunnerOption[];
  onAdvance: (base: keyof BranchRunners) => void;
  onOut: (base: keyof BranchRunners) => void;
  onPinchRun: (base: keyof BranchRunners, benchPlayerId: number) => void;
  onPlace: (base: keyof BranchRunners, playerId: number) => void;
}

const BASE_POSITIONS: Record<keyof BranchRunners, { cx: number; cy: number; label: string }> = {
  second: { cx: 100, cy: 55, label: "2B" },
  third: { cx: 45, cy: 100, label: "3B" },
  first: { cx: 155, cy: 100, label: "1B" },
};

const BASES = Object.keys(BASE_POSITIONS) as (keyof BranchRunners)[];

function lastName(names: Record<number, string>, id: number): string {
  const full = playerLabel(names, id);
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

export function DiamondField({
  runners,
  playerNames,
  getBenchOptions,
  placeOptions,
  onAdvance,
  onOut,
  onPinchRun,
  onPlace,
}: Props) {
  const [selected, setSelected] = useState<keyof BranchRunners | null>(null);
  const [pickingPinch, setPickingPinch] = useState(false);

  const selectedOccupied = selected != null && runners[selected] != null;

  useEffect(() => {
    if (selected == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setPickingPinch(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const dismiss = () => {
    setSelected(null);
    setPickingPinch(false);
  };

  const selectBase = (base: keyof BranchRunners) => {
    if (selected === base) {
      dismiss();
      return;
    }
    setSelected(base);
    setPickingPinch(false);
  };

  return (
    <div className="rounded-2xl border border-app bg-emerald-950/30 px-4 py-5">
      <p className="mb-3 text-center text-xs font-mono uppercase tracking-wider text-app-faint">
        Tap a runner for Advance, Out, or Pinch run
      </p>

      {selected && (
        <button
          type="button"
          aria-label="Dismiss runner actions"
          className="fixed inset-0 z-10 cursor-default bg-black/25"
          onClick={dismiss}
        />
      )}

      <div className="relative mx-auto h-44 w-full max-w-xs">
        <svg viewBox="0 0 200 170" className="relative z-20 h-full w-full">
          <path
            d="M 20 120 Q 100 10 180 120"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
          />
          <polygon
            points="100,130 155,100 100,70 45,100"
            fill="rgba(16,185,129,0.08)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />
          <circle cx="100" cy="100" r="4" fill="rgba(255,255,255,0.15)" />

          {BASES.map((base) => {
            const pos = BASE_POSITIONS[base];
            const runnerId = runners[base];
            const occupied = runnerId != null;
            const isSelected = selected === base;
            return (
              <g
                key={base}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  selectBase(base);
                }}
                role="button"
                aria-label={
                  occupied
                    ? `${pos.label}, ${playerLabel(playerNames, runnerId)}`
                    : `Empty ${pos.label}`
                }
              >
                <rect
                  x={pos.cx - 14}
                  y={pos.cy - 14}
                  width="28"
                  height="28"
                  rx="4"
                  transform={`rotate(45 ${pos.cx} ${pos.cy})`}
                  fill={
                    isSelected
                      ? "rgba(167,139,250,0.55)"
                      : occupied
                        ? "rgba(52,211,153,0.45)"
                        : "rgba(255,255,255,0.06)"
                  }
                  stroke={
                    isSelected
                      ? "rgba(196,181,253,0.95)"
                      : occupied
                        ? "rgba(52,211,153,0.8)"
                        : "rgba(255,255,255,0.2)"
                  }
                  strokeWidth="1.5"
                />
                <text
                  x={pos.cx}
                  y={pos.cy + 28}
                  textAnchor="middle"
                  className="fill-white/40 text-[9px] font-mono"
                >
                  {pos.label}
                </text>
                {occupied && (
                  <text
                    x={pos.cx}
                    y={pos.cy + 3}
                    textAnchor="middle"
                    className="fill-white text-[8px] font-medium"
                  >
                    {lastName(playerNames, runnerId)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {selected && (
          <div
            className="absolute z-30 w-52 -translate-x-1/2"
            style={{
              left: `${(BASE_POSITIONS[selected].cx / 200) * 100}%`,
              top: `${((BASE_POSITIONS[selected].cy + 22) / 170) * 100}%`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rounded-xl border border-app app-surface-elevated p-2 shadow-lg">
              {selectedOccupied ? (
                <OccupiedActions
                  runnerId={runners[selected]!}
                  playerNames={playerNames}
                  pickingPinch={pickingPinch}
                  benchOptions={getBenchOptions(runners[selected]!)}
                  onAdvance={() => {
                    onAdvance(selected);
                    dismiss();
                  }}
                  onOut={() => {
                    onOut(selected);
                    dismiss();
                  }}
                  onStartPinch={() => setPickingPinch(true)}
                  onPinchRun={(playerId) => {
                    onPinchRun(selected, playerId);
                    dismiss();
                  }}
                />
              ) : (
                <PlaceRunnerList
                  options={placeOptions}
                  playerNames={playerNames}
                  onPlace={(playerId) => {
                    onPlace(selected, playerId);
                    dismiss();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OccupiedActions({
  runnerId,
  playerNames,
  pickingPinch,
  benchOptions,
  onAdvance,
  onOut,
  onStartPinch,
  onPinchRun,
}: {
  runnerId: number;
  playerNames: Record<number, string>;
  pickingPinch: boolean;
  benchOptions: RunnerOption[];
  onAdvance: () => void;
  onOut: () => void;
  onStartPinch: () => void;
  onPinchRun: (playerId: number) => void;
}) {
  const pinchDisabled = benchOptions.every((opt) => opt.disabled) || benchOptions.length === 0;

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-medium text-app truncate">
        {playerLabel(playerNames, runnerId)}
      </p>
      {!pickingPinch ? (
        <div className="grid grid-cols-3 gap-1">
          <ActionButton label="Advance" onClick={onAdvance} />
          <ActionButton label="Out" onClick={onOut} />
          <ActionButton
            label="Pinch"
            disabled={pinchDisabled}
            title={pinchDisabled ? "No eligible pinch runners on the bench" : undefined}
            onClick={onStartPinch}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="px-1 text-[10px] text-app-muted">Pinch runner</p>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {benchOptions.map((opt) => (
              <button
                key={opt.playerId}
                type="button"
                disabled={opt.disabled}
                title={opt.reason}
                onClick={() => onPinchRun(opt.playerId)}
                className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[11px] text-violet-900 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-100"
              >
                {playerLabel(playerNames, opt.playerId)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceRunnerList({
  options,
  playerNames,
  onPlace,
}: {
  options: RunnerOption[];
  playerNames: Record<number, string>;
  onPlace: (playerId: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] font-medium text-app">Place runner</p>
      {options.length === 0 ? (
        <p className="px-1 text-[10px] text-app-muted">No available runners.</p>
      ) : (
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.playerId}
              type="button"
              disabled={opt.disabled}
              onClick={() => onPlace(opt.playerId)}
              className="rounded-lg border border-app px-2 py-1 text-[11px] text-app-secondary hover:bg-slate-200 dark:hover:bg-white/10"
            >
              {playerLabel(playerNames, opt.playerId)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="min-h-10 rounded-lg border border-amber-500/35 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-900 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-200"
    >
      {label}
    </button>
  );
}
