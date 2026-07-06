import { Link } from "react-router-dom";
import type { PlayerRankingRow, RankingsLeaderboardSort, TeamRankingRow } from "../api/types";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { LoadingText } from "../components/ui/LoadingSkeleton";
import { orderLabel, useRankings } from "../hooks/useRankings";
import { formatRate, formatRe } from "../utils/format";

export function RankingsScreen() {
  const {
    view,
    period,
    sort,
    order,
    meta,
    loading,
    error,
    sortedPlayerRows,
    sortedTeamRows,
    setViewAndSync,
    setPeriodAndSync,
    setSortAndSync,
    setOrderAndSync,
  } = useRankings();

  const displayedRows = view === "players" ? sortedPlayerRows : sortedTeamRows;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-sm text-white/50 mt-1 leading-relaxed">
          Data loads once per period from precomputed totals; switching players/teams or sort is instant.
          Last 7 days matches the DB retention window; season totals accumulate
          from program start.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={view}
          options={[
            { value: "players", label: "Players" },
            { value: "teams", label: "Teams" },
          ]}
          onChange={setViewAndSync}
        />
        <SegmentedControl
          value={period}
          options={[
            { value: "week", label: "Last 7 days" },
            { value: "season", label: "Season" },
          ]}
          onChange={setPeriodAndSync}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={sort}
          options={[
            { value: "missedRe", label: "Missed RE" },
            { value: "gainedRe", label: "Gained RE" },
            { value: "challengeSuccess", label: "Challenge success %" },
          ]}
          onChange={setSortAndSync}
        />
        <SegmentedControl
          value={order}
          options={[
            { value: "desc", label: "High → Low" },
            { value: "asc", label: "Low → High" },
          ]}
          onChange={setOrderAndSync}
        />
      </div>

      {meta && (
        <p className="text-xs text-white/40 font-mono">
          {meta.periodLabel}
          {meta.gameCount > 0 && ` · ${meta.gameCount} tracked games`}
          {` · ${orderLabel(sort, order)}`}
        </p>
      )}

      {loading && <LoadingText>Loading rankings…</LoadingText>}

      {error && !loading && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && displayedRows.length === 0 && (
        <p className="text-sm text-white/40">
          No tracked games in this window yet.
        </p>
      )}

      {!loading && !error && displayedRows.length > 0 && view === "players" && (
        <PlayerTable rows={sortedPlayerRows} activeSort={sort} />
      )}

      {!loading && !error && displayedRows.length > 0 && view === "teams" && (
        <TeamTable rows={sortedTeamRows} activeSort={sort} />
      )}

      <p className="text-[11px] text-white/30 leading-relaxed">
        Missed RE = postgame audit run expectancy left on the table (batting side).
        Gained RE = run expectancy captured on successful overturns (batting or
        fielding side). Challenge success % = overturned challenges ÷ challenges
        used. Players with no challenges show — for success % sorts.
      </p>
    </div>
  );
}

function thClass(active: boolean): string {
  return `px-3 py-2 font-medium text-right${active ? " text-emerald-300/90" : ""}${
    active ? "" : " hidden sm:table-cell"
  }`;
}

function PlayerTable({
  rows,
  activeSort,
}: {
  rows: PlayerRankingRow[];
  activeSort: RankingsLeaderboardSort;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className={thClass(activeSort === "missedRe")}>Missed RE</th>
            <th className={thClass(activeSort === "gainedRe")}>Bat gained RE</th>
            <th className={thClass(activeSort === "gainedRe")}>Fld gained RE</th>
            <th className="px-3 py-2 font-medium text-right">Misses</th>
            <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Challenges</th>
            <th className={activeSort === "challengeSuccess" ? "px-3 py-2 font-medium text-right text-emerald-300/90" : "px-3 py-2 font-medium text-right"}>
              Success %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId} className="border-b border-white/5 hover:bg-white/3">
              <td className="px-3 py-2.5 text-white/40 font-mono text-xs">{row.rank}</td>
              <td className="px-3 py-2.5 font-medium">
                {row.playerName || `Player ${row.playerId}`}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "missedRe" ? "text-amber-300" : "text-amber-300/90 hidden sm:table-cell"
              }`}>
                {formatRe(row.totalMissedValue)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "gainedRe" ? "text-emerald-300" : "text-emerald-300/80 hidden sm:table-cell"
              }`}>
                {formatRe(row.battingGainedRe)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "gainedRe" ? "text-emerald-300" : "text-emerald-300/80 hidden sm:table-cell"
              }`}>
                {formatRe(row.fieldingGainedRe)}
              </td>
              <td className="px-3 py-2.5 text-right">{row.missedOpportunities}</td>
              <td className="px-3 py-2.5 text-right hidden sm:table-cell">{row.challengesUsed}</td>
              <td className={`px-3 py-2.5 text-right ${
                activeSort === "challengeSuccess" ? "text-white/90 font-medium" : "text-white/60"
              }`}>
                {formatRate(row.overturnRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamTable({
  rows,
  activeSort,
}: {
  rows: TeamRankingRow[];
  activeSort: RankingsLeaderboardSort;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className={thClass(activeSort === "missedRe")}>Batting missed RE</th>
            <th className={thClass(activeSort === "gainedRe")}>Bat gained RE</th>
            <th className={thClass(activeSort === "gainedRe")}>Fld gained RE</th>
            <th className="px-3 py-2 font-medium text-right">Misses</th>
            <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Challenges</th>
            <th className={activeSort === "challengeSuccess" ? "px-3 py-2 font-medium text-right text-emerald-300/90" : "px-3 py-2 font-medium text-right"}>
              Success %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId} className="border-b border-white/5 hover:bg-white/3">
              <td className="px-3 py-2.5 text-white/40 font-mono text-xs">{row.rank}</td>
              <td className="px-3 py-2.5 font-medium">
                <Link to="/" className="hover:text-emerald-300 transition-colors">
                  {row.teamAbbrev}
                </Link>
                <span className="text-white/30 text-xs ml-2 hidden sm:inline">{row.teamName}</span>
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "missedRe" ? "text-amber-300" : "text-amber-300/90 hidden sm:table-cell"
              }`}>
                {formatRe(row.battingMissedValue)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "gainedRe" ? "text-emerald-300" : "text-emerald-300/80 hidden sm:table-cell"
              }`}>
                {formatRe(row.battingGainedRe)}
              </td>
              <td className={`px-3 py-2.5 text-right font-mono ${
                activeSort === "gainedRe" ? "text-emerald-300" : "text-emerald-300/80 hidden sm:table-cell"
              }`}>
                {formatRe(row.fieldingGainedRe)}
              </td>
              <td className="px-3 py-2.5 text-right">{row.battingMissedCount}</td>
              <td className="px-3 py-2.5 text-right hidden sm:table-cell">{row.challengesUsed}</td>
              <td className={`px-3 py-2.5 text-right ${
                activeSort === "challengeSuccess" ? "text-white/90 font-medium" : "text-white/60"
              }`}>
                {formatRate(row.overturnRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
