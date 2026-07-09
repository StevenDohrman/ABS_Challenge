import type { BranchRunners } from "../state/branchTypes";

interface Props {
  runners: BranchRunners;
  onToggleBase: (base: keyof BranchRunners) => void;
}

const BASE_POSITIONS: Record<keyof BranchRunners, { cx: number; cy: number; label: string }> = {
  second: { cx: 100, cy: 55, label: "2B" },
  third: { cx: 45, cy: 100, label: "3B" },
  first: { cx: 155, cy: 100, label: "1B" },
};

export function DiamondField({ runners, onToggleBase }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-emerald-950/30 px-4 py-5">
      <p className="mb-3 text-center text-xs font-mono uppercase tracking-wider text-white/35">
        Tap a base to toggle runner
      </p>
      <svg viewBox="0 0 200 170" className="mx-auto h-44 w-full max-w-xs">
        {/* Outfield arc */}
        <path
          d="M 20 120 Q 100 10 180 120"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="2"
        />
        {/* Infield diamond */}
        <polygon
          points="100,130 155,100 100,70 45,100"
          fill="rgba(16,185,129,0.08)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
        />
        {/* Pitcher's mound */}
        <circle cx="100" cy="100" r="4" fill="rgba(255,255,255,0.15)" />

        {(Object.keys(BASE_POSITIONS) as (keyof BranchRunners)[]).map((base) => {
          const pos = BASE_POSITIONS[base];
          const occupied = runners[base] != null;
          return (
            <g
              key={base}
              className="cursor-pointer"
              onClick={() => onToggleBase(base)}
              role="button"
              aria-label={`Toggle runner on ${pos.label}`}
            >
              <rect
                x={pos.cx - 14}
                y={pos.cy - 14}
                width="28"
                height="28"
                rx="4"
                transform={`rotate(45 ${pos.cx} ${pos.cy})`}
                fill={occupied ? "rgba(52,211,153,0.45)" : "rgba(255,255,255,0.06)"}
                stroke={occupied ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.2)"}
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}
