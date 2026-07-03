import { useState } from "react";
import type { AtBatHistoryItem, ChallengeOutcome } from "../api/types";
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

// ── Challenge outcome badge ────────────────────────────────────────────────

function ChallengeBadge({ outcome }: { outcome: ChallengeOutcome }) {
  const overturned = outcome.isOverturned;
  const inProgress = outcome.isOverturned === null;

  const colorCls = inProgress
    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
    : overturned
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
      : "bg-red-500/15 border-red-500/30 text-red-300";

  const resultLabel = inProgress ? "In Review" : overturned ? "Overturned" : "Upheld";
  const sideLabel = outcome.challengerSide === "batter" ? "Batter" : "Fielding";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${colorCls}`}
      title={outcome.challengerName ? `${outcome.challengerName} challenged` : undefined}
    >
      {sideLabel} · {resultLabel}
    </span>
  );
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
          {/* Challenge outcome badge on the left */}
          {ab.challengeOutcome && (
            <div className="mt-0.5">
              <ChallengeBadge outcome={ab.challengeOutcome} />
            </div>
          )}
          {ab.postgameAudit?.missedChallenge && (
            <div className="mt-0.5">
              <span className="inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border bg-orange-500/15 border-orange-500/30 text-orange-300">
                Missed · Zone {ab.postgameAudit.zoneResult}
                {!ab.postgameAudit.challengeAvailable && " · out of challenges"}
              </span>
            </div>
          )}
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

// ── Inning section with collapse ────────────────────────────────────────────

function InningSection({ group, defaultOpen }: { group: InningGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const challengeCount = group.atBats.filter((ab) => ab.challengeOutcome !== null).length;
  const overturnedCount = group.atBats.filter(
    (ab) => ab.challengeOutcome?.isOverturned === true
  ).length;

  return (
    <section className="space-y-0">
      {/* Inning header — clickable to collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1 group"
      >
        <span className="text-xs font-mono text-white/50 font-semibold tracking-wide">
          {group.label}
        </span>

        {/* Per-inning challenge summary */}
        {challengeCount > 0 && (
          <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
            {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
            {overturnedCount > 0 && ` · ${overturnedCount} overturned`}
          </span>
        )}

        <div className="flex-1 h-px bg-white/10" />

        <span className={`text-white/20 text-xs transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          {group.atBats.map((ab) => (
            <AtBatRow key={ab.atBatIndex} ab={ab} />
          ))}
        </div>
      )}
    </section>
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

  const challengeCount  = atBats.filter((ab) => ab.challengeOutcome !== null).length;
  const overturnedCount = atBats.filter((ab) => ab.challengeOutcome?.isOverturned === true).length;
  const autoAllowCount  = atBats.filter((ab) => ab.triggeredRecommendation === "AUTO_ALLOW").length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatChip label="At-bats tracked" value={atBats.length} />
        <StatChip label="Called strikes" value={atBats.filter((ab) => ab.triggeredCount !== null).length} />
        <StatChip
          label="Challenges"
          value={challengeCount}
          sub={challengeCount > 0 ? `${overturnedCount} overturned` : undefined}
          accent="text-orange-300"
        />
        <StatChip label="Auto-allow" value={autoAllowCount} accent="text-emerald-300" />
      </div>

      {/* Inning sections */}
      <div className="space-y-4">
        {groups.map((group, i) => (
          <InningSection
            key={`${group.inning}-${group.half}`}
            group={group}
            defaultOpen={i === groups.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function StatChip({
  label, value, sub, accent = "text-white",
}: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-center">
      <p className={`text-xl font-bold font-mono ${accent}`}>{value}</p>
      <p className="text-[11px] text-white/35 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}
