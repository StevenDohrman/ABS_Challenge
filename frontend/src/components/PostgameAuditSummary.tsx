import { useState } from "react";
import { Link } from "react-router-dom";
import type { PostgameAuditResponse, PostgameAuditItem } from "../api/types";
import { RecommendationBadge } from "./RecommendationBadge";
import { ExpectedValuePill } from "./ExpectedValuePill";

interface Props {
  audit: PostgameAuditResponse | null;
  loading: boolean;
  awayAbbrev: string;
  homeAbbrev: string;
}

function formatMissedValue(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function TeamMissedCard({
  abbrev,
  summary,
}: {
  abbrev: string;
  summary: PostgameAuditResponse["summary"]["byTeam"]["away"];
}) {
  return (
    <div className="bg-slate-950 px-4 py-4 text-center">
      <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2">
        {abbrev}
      </p>
      <p className="text-xl font-bold font-mono text-orange-300 tabular-nums">
        {formatMissedValue(summary.totalMissedValue)}
      </p>
      <p className="text-[11px] text-white/35 mt-1">Value missed (RE)</p>
      <p className="text-[11px] font-mono text-white/30 mt-2">
        {summary.missedChallengeCount} missed · {summary.badChallengeCount} bad
      </p>
    </div>
  );
}

function formatHalfInning(half: string, inning: number): string {
  const arrow = half === "Top" ? "▲" : "▼";
  return `${arrow} ${inning}${ordinalSuffix(inning)}`;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

function MissedRow({ item, rank }: { item: PostgameAuditItem; rank?: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      {rank !== undefined && (
        <span className="text-xs font-mono text-white/25 w-4 shrink-0">{rank}</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-white/50">
            {formatHalfInning(item.halfInning, item.inning)}
          </span>
          <span className="text-xs font-mono text-white/30">·</span>
          <span className="text-xs font-mono text-white/50">{item.count}</span>
          {!item.challengeAvailable && (
            <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              Out of challenges
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/30 mt-0.5">
          Savant: {item.savantZoneResult} · Live: called strike
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RecommendationBadge
          recommendation={item.liveRecommendation}
          size="sm"
        />
        <ExpectedValuePill value={item.expectedValue} size="sm" />
      </div>
    </div>
  );
}

export function PostgameAuditSummary({ audit, loading, awayAbbrev, homeAbbrev }: Props) {
  const [showAllMissed, setShowAllMissed] = useState(false);

  if (loading && !audit) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-6 animate-pulse">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="h-8 w-48 bg-white/10 rounded" />
      </div>
    );
  }

  if (!audit) return null;

  const { summary, status, enrichedAt } = audit;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/40">
            Postgame audit
          </p>
          {status === "pending" && (
            <p className="text-xs text-amber-400/80 mt-1">
              {audit.pollEarliestAt && new Date(audit.pollEarliestAt) > new Date()
                ? `Postgame audit starts ${new Date(audit.pollEarliestAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (14h after final)`
                : "Checking Savant for pitch data every 10 min…"}
            </p>
          )}
          {status === "ready" && enrichedAt && (
            <p className="text-[11px] text-white/25 font-mono mt-1">
              Enriched {new Date(enrichedAt).toLocaleTimeString()}
            </p>
          )}
          {status === "unavailable" && (
            <p className="text-xs text-white/30 mt-1">Savant data unavailable</p>
          )}
        </div>
        {status === "pending" && (
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>

      {status === "ready" && (
        <>
          <div className="grid grid-cols-3 gap-px bg-white/10">
            <TeamMissedCard abbrev={awayAbbrev} summary={summary.byTeam.away} />
            <div className="bg-slate-950 px-4 py-4 text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-2">
                Game
              </p>
              <p className="text-xl font-bold font-mono text-orange-300 tabular-nums">
                {formatMissedValue(summary.totalMissedValue)}
              </p>
              <p className="text-[11px] text-white/35 mt-1">Total value missed (RE)</p>
              <p className="text-[11px] font-mono text-white/30 mt-2">
                {summary.missedChallengeCount} missed · {summary.badChallengeCount} bad
              </p>
            </div>
            <TeamMissedCard abbrev={homeAbbrev} summary={summary.byTeam.home} />
          </div>

          {summary.missedChallengeCount > 0 && (
            <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
              <p className="text-[11px] text-white/30 text-center font-mono">
                Team splits count missed opportunities when that team was batting
                (Top = {awayAbbrev}, Bot = {homeAbbrev})
              </p>
            </div>
          )}

          {summary.topMissed.length > 0 && (
            <div className="px-5 py-4 border-t border-white/10">
              <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3">
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
            <div className="border-t border-white/10">
              <button
                onClick={() => setShowAllMissed((v) => !v)}
                className="w-full px-5 py-3 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors text-left"
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
              <p className="text-sm text-white/40">No missed high-value challenges in this game.</p>
            </div>
          )}
        </>
      )}

          {status === "pending" && (
            <div className="px-5 py-6 text-center space-y-2">
              <p className="text-sm text-white/40">
                {audit.pollEarliestAt && new Date(audit.pollEarliestAt) > new Date()
                  ? "Statcast pitch data is typically available ~14 hours after the final out."
                  : "Statcast pitch data typically appears 12–24 hours after the final out."}
              </p>
          <Link to="/how-it-works" className="text-xs text-white/30 hover:text-white/60 underline">
            Learn how postgame audit works
          </Link>
        </div>
      )}
    </section>
  );
}
