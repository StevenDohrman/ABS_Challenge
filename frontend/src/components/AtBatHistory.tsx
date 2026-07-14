import { useState } from "react";
import type { AtBatHistoryItem, ChallengeOutcome } from "../api/types";
import { formatOrdinal, inningHalfArrow } from "../utils/baseballDisplay";
import { EmptyState } from "./ui/EmptyState";
import { CountGrid } from "./CountGrid";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";
import { DisclosureChevron } from "./ui/DisclosureChevron";

interface Props {
  atBats: AtBatHistoryItem[];
}

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
      map.set(key, {
        label: `${inningHalfArrow(ab.halfInning)} ${formatOrdinal(ab.inning)}`,
        inning: ab.inning,
        half: ab.halfInning,
        atBats: [],
      });
    }
    map.get(key)!.atBats.push(ab);
  }
  return [...map.values()];
}

function ChallengeBadge({ outcome }: { outcome: ChallengeOutcome }) {
  const overturned = outcome.isOverturned;
  const inProgress = outcome.isOverturned === null;

  const colorCls = inProgress
    ? "bg-amber-500/15 border-amber-500/35 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300"
    : overturned
      ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300"
      : "bg-red-500/15 border-red-500/35 text-red-800 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300";

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

function AtBatRow({ ab }: { ab: AtBatHistoryItem }) {
  const [expanded, setExpanded] = useState(false);

  const hasChallenge = ab.triggeredCount !== null;
  const rec = ab.triggeredRecommendation as "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY" | null;

  return (
    <div className="rounded-xl border border-app overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 sm:px-4 py-3 min-h-11 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 app-hover-row transition-colors"
      >
        <div className="flex items-start gap-3 w-full sm:flex-1 sm:min-w-0">
          <span className="text-xs font-mono text-app-faint w-6 shrink-0 pt-0.5">
            #{ab.atBatIndex + 1}
          </span>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-app-muted">
                {ab.outs} out{ab.outs !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-app-faint">·</span>
              <span className="text-xs font-mono text-app-muted">{ab.baseState}</span>
            </div>
            {ab.challengeOutcome && (
              <div>
                <ChallengeBadge outcome={ab.challengeOutcome} />
              </div>
            )}
            {ab.postgameAudit?.missedChallenge && (
              <div>
                <span className="inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border bg-orange-500/15 border-orange-500/35 text-orange-800 dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-300">
                  Missed {ab.postgameAudit.challengeSide === "fielding" ? "fielding" : "batting"} · Zone {ab.postgameAudit.zoneResult}
                  {!ab.postgameAudit.challengeAvailable && " · out of challenges"}
                </span>
              </div>
            )}
          </div>

          <DisclosureChevron open={expanded} className="sm:hidden shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-2 pl-9 sm:pl-0 sm:shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          {hasChallenge && rec ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-app-muted">{ab.triggeredCount}</span>
              <RecommendationBadge recommendation={rec} size="sm" />
              {ab.triggeredExpectedValue !== null && (
                <ExpectedValuePill value={ab.triggeredExpectedValue} size="sm" />
              )}
            </div>
          ) : (
            <span className="text-xs font-mono text-app-dim">No challenge</span>
          )}
          <DisclosureChevron open={expanded} className="hidden sm:inline-block ml-1" />
        </div>
      </button>

      {expanded && ab.recommendations.length > 0 && (
        <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-app app-surface-subtle">
          <p className="text-xs text-app-faint font-mono uppercase tracking-wide mb-3">
            Count grid — all 12 pre-computed recommendations
          </p>
          <CountGrid
            recommendations={ab.recommendations}
            activeCount={ab.triggeredCount ?? undefined}
          />
        </div>
      )}

      {expanded && ab.recommendations.length === 0 && (
        <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-app">
          <p className="text-xs text-app-faint font-mono">
            No recommendations recorded for this at-bat.
          </p>
        </div>
      )}
    </div>
  );
}

function InningSection({ group, defaultOpen }: { group: InningGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const challengeCount = group.atBats.filter((ab) => ab.challengeOutcome !== null).length;
  const overturnedCount = group.atBats.filter(
    (ab) => ab.challengeOutcome?.isOverturned === true
  ).length;

  return (
    <section className="space-y-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-2 min-h-11 group"
      >
        <span className="text-xs font-mono text-app-muted font-semibold tracking-wide">
          {group.label}
        </span>

        {challengeCount > 0 && (
          <span className="text-[10px] font-mono text-orange-700 bg-orange-500/15 border border-orange-500/25 px-1.5 py-0.5 rounded dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20">
            {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
            {overturnedCount > 0 && ` · ${overturnedCount} overturned`}
          </span>
        )}

        <div className="flex-1 h-px app-divider" />

        <DisclosureChevron open={open} />
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

export function AtBatHistory({ atBats }: Props) {
  const groups = groupByInning(atBats);

  if (atBats.length === 0) {
    return <EmptyState title="No at-bat data recorded yet." elevated={false} />;
  }

  const challengeCount = atBats.filter((ab) => ab.challengeOutcome !== null).length;
  const overturnedCount = atBats.filter((ab) => ab.challengeOutcome?.isOverturned === true).length;
  const autoAllowCount = atBats.filter((ab) => ab.triggeredRecommendation === "AUTO_ALLOW").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatChip label="At-bats tracked" value={atBats.length} />
        <StatChip label="Called strikes" value={atBats.filter((ab) => ab.triggeredCount !== null).length} />
        <StatChip
          label="Challenges"
          value={challengeCount}
          sub={challengeCount > 0 ? `${overturnedCount} overturned` : undefined}
          accent="text-orange-600 dark:text-orange-300"
        />
        <StatChip label="Auto-allow" value={autoAllowCount} accent="text-emerald-700 dark:text-emerald-300" />
      </div>

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
  label, value, sub, accent = "text-app",
}: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl app-surface-muted border border-app px-3 py-2.5 text-center">
      <p className={`text-lg sm:text-xl font-bold font-mono ${accent}`}>{value}</p>
      <p className="text-[10px] sm:text-[11px] text-app-faint mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-app-dim mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}
