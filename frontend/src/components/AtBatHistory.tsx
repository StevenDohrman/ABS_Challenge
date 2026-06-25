import { useState } from "react";
import type { AtBatHistoryItem } from "../api/types";
import { CountGrid } from "./CountGrid";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";

interface Props {
  atBats: AtBatHistoryItem[];
}

// ── Inning grouping ────────────────────────────────────────────────────────

interface InningGroup {
  label: string;
  inning: number;
  half: string;
  atBats: AtBatHistoryItem[];
}

function groupByInning(atBats: AtBatHistoryItem[]): InningGroup[] {
  const map = new Map<string, InningGroup>();
  for (const ab of atBats) {
    const key = `${ab.inning}-${ab.halfInning}`;
    if (!map.has(key)) {
      const ordinal = ordinalSuffix(ab.inning);
      map.set(key, {
        label: `${ab.halfInning === "Top" ? "▲" : "▼"} ${ordinal}`,
        inning: ab.inning,
        half: ab.halfInning,
        atBats: [],
      });
    }
    map.get(key)!.atBats.push(ab);
  }
  return [...map.values()];
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ── At-bat row ─────────────────────────────────────────────────────────────

function AtBatRow({ ab }: { ab: AtBatHistoryItem }) {
  const [expanded, setExpanded] = useState(false);

  const hasChallenge = ab.triggeredCount !== null;
  const rec = ab.triggeredRecommendation as "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY" | null;

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {/* Row header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
      >
        {/* At-bat number */}
        <span className="text-xs font-mono text-white/30 w-6 shrink-0">
          #{ab.atBatIndex + 1}
        </span>

        {/* Situation */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-white/50">
              {ab.outs} out{ab.outs !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-white/30">·</span>
            <span className="text-xs font-mono text-white/50">{ab.baseState}</span>
          </div>
        </div>

        {/* Triggered recommendation (if any) */}
        {hasChallenge && rec ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-white/40">{ab.triggeredCount}</span>
            <RecommendationBadge recommendation={rec} size="sm" />
            {ab.triggeredExpectedValue !== null && (
              <ExpectedValuePill value={ab.triggeredExpectedValue} size="sm" />
            )}
          </div>
        ) : (
          <span className="text-xs font-mono text-white/20 shrink-0">No challenge</span>
        )}

        {/* Expand chevron */}
        <span
          className={`text-white/25 text-xs transition-transform duration-200 ml-1 ${expanded ? "rotate-90" : ""}`}
        >
          ▶
        </span>
      </button>

      {/* Expanded count grid */}
      {expanded && ab.recommendations.length > 0 && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 bg-white/3">
          <p className="text-xs text-white/30 font-mono uppercase tracking-wide mb-3">
            Count grid — all 12 pre-computed recommendations
          </p>
          <CountGrid
            recommendations={ab.recommendations}
            activeCount={ab.triggeredCount ?? undefined}
          />
        </div>
      )}

      {expanded && ab.recommendations.length === 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-white/10">
          <p className="text-xs text-white/30 font-mono">
            No recommendations recorded for this at-bat.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function AtBatHistory({ atBats }: Props) {
  const groups = groupByInning(atBats);

  if (atBats.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 px-5 py-8 text-center">
        <p className="text-white/40 text-sm">No at-bat data recorded yet.</p>
      </div>
    );
  }

  const challengeCount = atBats.filter((ab) => ab.triggeredCount !== null).length;
  const autoAllowCount = atBats.filter((ab) => ab.triggeredRecommendation === "AUTO_ALLOW").length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip label="At-bats tracked" value={atBats.length} />
        <StatChip label="Called strikes" value={challengeCount} />
        <StatChip label="Auto-allow" value={autoAllowCount} accent="text-emerald-300" />
      </div>

      {/* Inning sections */}
      {groups.map((group) => (
        <section key={`${group.inning}-${group.half}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/50 font-semibold tracking-wide">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="space-y-2">
            {group.atBats.map((ab) => (
              <AtBatRow key={ab.atBatIndex} ab={ab} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatChip({
  label, value, accent = "text-white",
}: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
      <p className={`text-xl font-bold font-mono ${accent}`}>{value}</p>
      <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
    </div>
  );
}
