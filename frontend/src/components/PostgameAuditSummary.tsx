import { useState } from "react";
import { Link } from "react-router-dom";
import type { PostgameAuditResponse, PostgameAuditItem } from "../api/types";
import { formatHalfInning } from "../utils/baseballDisplay";
import { formatSignedDecimal } from "../utils/format";
import { AuditSummarySkeleton } from "./ui/LoadingSkeleton";
import { PulsingDot } from "./ui/PulsingDot";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";

interface Props {
  audit: PostgameAuditResponse | null;
  loading: boolean;
  awayAbbrev: string;
  homeAbbrev: string;
}

function TeamMissedCard({
  abbrev,
  summary,
}: {
  abbrev: string;
  summary: PostgameAuditResponse["summary"]["byTeam"]["away"];
}) {
  return (
    <div className="bg-slate-100 dark:bg-slate-950 px-4 py-4 text-center">
      <p className="text-[10px] font-mono uppercase tracking-widest text-app-faint mb-2">
        {abbrev}
      </p>
      <p className="text-xl font-bold font-mono text-orange-700 dark:text-orange-300 tabular-nums">
        {formatSignedDecimal(summary.totalMissedValue)}
      </p>
      <p className="text-[11px] text-app-faint mt-1">Value missed (RE)</p>
      <p className="text-[11px] font-mono text-app-faint mt-2">
        {summary.missedChallengeCount} missed · {summary.badChallengeCount} bad
      </p>
    </div>
  );
}

function MissedRow({ item, rank }: { item: PostgameAuditItem; rank?: number }) {
  const isFielding = item.challengeSide === "fielding";
  const callLabel = isFielding ? "called ball" : "called strike";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 border-b border-app-subtle last:border-0">
      {rank !== undefined && (
        <span className="text-xs font-mono text-app-dim w-4 shrink-0">{rank}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-app-muted">
            {formatHalfInning(item.halfInning, item.inning)}
          </span>
          <span className="text-xs font-mono text-app-faint">·</span>
          <span className="text-xs font-mono text-app-muted">{item.count}</span>
          <span className="text-[10px] font-mono text-sky-800 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded dark:text-sky-300/80 dark:bg-sky-500/10 dark:border-sky-500/20">
            {isFielding ? "Fielding" : "Batting"}
          </span>
          {!item.challengeAvailable && (
            <span className="text-[10px] font-mono text-amber-800 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded dark:text-amber-400/80 dark:bg-amber-500/10 dark:border-amber-500/20">
              Out of challenges
            </span>
          )}
        </div>
        <p className="text-[11px] text-app-faint mt-0.5">
          Zone: {item.zoneResult} · Live: {callLabel}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.liveRecommendation !== "FIELDING" && item.liveRecommendation !== "NONE" ? (
          <RecommendationBadge
            recommendation={item.liveRecommendation}
            size="sm"
          />
        ) : (
          <span className="text-[10px] font-mono text-app-muted border border-app px-1.5 py-0.5 rounded">
            {item.challengeSide === "fielding" ? "Zone RE" : "Calculated RE"}
          </span>
        )}
        <ExpectedValuePill value={item.expectedValue} size="sm" />
      </div>
    </div>
  );
}

export function PostgameAuditSummary({ audit, loading, awayAbbrev, homeAbbrev }: Props) {
  const [showAllMissed, setShowAllMissed] = useState(false);

  if (loading && !audit) {
    return <AuditSummarySkeleton />;
  }

  if (!audit) return null;

  const { summary, status, enrichedAt } = audit;

  return (
    <section className="rounded-2xl border border-app app-surface-subtle overflow-hidden">
      <div className="px-5 py-4 border-b border-app flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-app-muted">
            Postgame audit
          </p>
          {status === "pending" && (
            <p className="text-xs text-amber-400/80 mt-1">
              Running postgame audit from MLB pitch data…
            </p>
          )}
          {status === "ready" && enrichedAt && (
            <p className="text-[11px] text-app-dim font-mono mt-1">
              Audited {new Date(enrichedAt).toLocaleTimeString()}
            </p>
          )}
          {status === "unavailable" && (
            <p className="text-xs text-app-faint mt-1">Postgame audit unavailable</p>
          )}
        </div>
        {status === "pending" && (
          <PulsingDot color="amber" animation="pulse" />
        )}
      </div>

      {status === "ready" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px app-divider">
            <TeamMissedCard abbrev={awayAbbrev} summary={summary.byTeam.away} />
            <div className="bg-slate-100 dark:bg-slate-950 px-4 py-4 text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-app-faint mb-2">
                Game
              </p>
              <p className="text-xl font-bold font-mono text-orange-700 dark:text-orange-300 tabular-nums">
                {formatSignedDecimal(summary.totalMissedValue)}
              </p>
              <p className="text-[11px] text-app-faint mt-1">Total value missed (RE)</p>
              <p className="text-[11px] font-mono text-app-faint mt-2">
                {summary.missedChallengeCount} missed · {summary.badChallengeCount} bad
              </p>
            </div>
            <TeamMissedCard abbrev={homeAbbrev} summary={summary.byTeam.home} />
          </div>

          {summary.missedChallengeCount > 0 && (
            <div className="px-5 py-3 border-t border-app app-surface-subtle">
              <p className="text-[11px] text-app-faint text-center font-mono">
                Team splits attribute missed value to the team that should have
                challenged — batting (called strikes) or fielding (called balls).
                Top = {awayAbbrev}, Bot = {homeAbbrev}.
              </p>
            </div>
          )}

          {summary.topMissed.length > 0 && (
            <div className="px-5 py-4 border-t border-app">
              <p className="text-xs font-mono uppercase tracking-widest text-app-muted mb-3">
                Top missed opportunities
              </p>
              <div>
                {summary.topMissed.map((item, i) => (
                  <MissedRow key={`${item.atBatIndex}-${item.pitchNumber}`} item={item} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {audit.missedChallenges.length > summary.topMissed.length && (
            <div className="border-t border-app">
              <button
                onClick={() => setShowAllMissed((v) => !v)}
                className="w-full px-4 sm:px-5 py-3 min-h-11 text-sm text-app-muted hover:text-app-secondary app-hover-row transition-colors text-left"
              >
                {showAllMissed ? "Hide" : "Show all"} missed challenges ({audit.missedChallenges.length})
              </button>
              {showAllMissed && (
                <div className="px-5 pb-4">
                  {audit.missedChallenges.map((item) => (
                    <MissedRow key={`all-${item.atBatIndex}-${item.pitchNumber}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {summary.missedChallengeCount === 0 && (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-app-muted">No missed high-value challenges in this game.</p>
            </div>
          )}
        </>
      )}

          {status === "pending" && (
            <div className="px-5 py-6 text-center space-y-2">
              <p className="text-sm text-app-muted">
                Postgame analysis runs shortly after the game goes final using MLB live feed pitch location data.
              </p>
          <Link to="/how-it-works" className="text-xs text-app-faint hover:text-app-secondary underline">
            Learn how postgame audit works
          </Link>
        </div>
      )}
    </section>
  );
}
