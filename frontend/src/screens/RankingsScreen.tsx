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
        <h1 className="text-xl sm:text-2xl font-bold">Rankings</h1>
        <p className="text-sm text-app-muted mt-1 leading-relaxed">
          Data loads once per period from precomputed totals; switching players/teams or sort is instant.
          Last 7 days matches the DB retention window; season totals accumulate
          from program start.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
        <p className="text-xs text-app-muted font-mono">
          {meta.periodLabel}
          {meta.gameCount > 0 && ` · ${meta.gameCount} tracked games`}
          {` · ${orderLabel(sort, order)}`}
        </p>
      )}

      {loading && <LoadingText>Loading rankings…</LoadingText>}

      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && displayedRows.length === 0 && (
        <p className="text-sm text-app-muted">
          No tracked games in this window yet.
        </p>
      )}

      {!loading && !error && displayedRows.length > 0 && view === "players" && (
        <>
          <div className="sm:hidden space-y-2">
            {sortedPlayerRows.map((row) => (
              <PlayerCard key={row.playerId} row={row} activeSort={sort} />
            ))}
          </div>
          <div className="hidden sm:block">
            <PlayerTable rows={sortedPlayerRows} activeSort={sort} />
          </div>
        </>
      )}

      {!loading && !error && displayedRows.length > 0 && view === "teams" && (
        <>
          <div className="sm:hidden space-y-2">
            {sortedTeamRows.map((row) => (
              <TeamCard key={row.teamId} row={row} activeSort={sort} />
            ))}
          </div>
          <div className="hidden sm:block">
            <TeamTable rows={sortedTeamRows} activeSort={sort} />
          </div>
        </>
      )}

      <p className="text-[11px] text-app-faint leading-relaxed">
        Missed RE = postgame audit run expectancy left on the table, split into
        batting and fielding columns. Batting misses credit the batter; fielding
        misses credit the catcher (not the pitcher). Gained RE = run expectancy
        captured on successful overturns. Challenge success % = overturned
        challenges ÷ challenges used.
      </p>
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-app-muted">{label}</span>
      <span className={`font-mono tabular-nums ${highlight ? "text-emerald-700 dark:text-emerald-300 font-medium" : "text-app"}`}>
        {value}
      </span>
    </div>
  );
}

function PlayerCard({ row, activeSort }: { row: PlayerRankingRow; activeSort: RankingsLeaderboardSort }) {
  return (
    <div className="rounded-xl border border-app app-surface-subtle px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-mono text-app-faint">#{row.rank}</span>
        <p className="font-medium text-app truncate flex-1">{row.playerName || `Player ${row.playerId}`}</p>
      </div>
      <StatRow label="Missed RE" value={formatRe(row.totalMissedValue)} highlight={activeSort === "missedRe"} />
      <StatRow label="Bat missed RE" value={formatRe(row.battingMissedValue)} />
      <StatRow label="Fld missed RE" value={formatRe(row.fieldingMissedValue)} />
      <StatRow label="Bat gained RE" value={formatRe(row.battingGainedRe)} highlight={activeSort === "gainedRe"} />
      <StatRow label="Fld gained RE" value={formatRe(row.fieldingGainedRe)} />
      <StatRow label="Misses" value={String(row.missedOpportunities)} />
      <StatRow label="Challenges" value={String(row.challengesUsed)} />
      <StatRow label="Success %" value={formatRate(row.overturnRate)} highlight={activeSort === "challengeSuccess"} />
    </div>
  );
}

function TeamCard({ row, activeSort }: { row: TeamRankingRow; activeSort: RankingsLeaderboardSort }) {
  return (
    <div className="rounded-xl border border-app app-surface-subtle px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-mono text-app-faint">#{row.rank}</span>
        <Link to="/" className="font-medium text-app hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
          {row.teamAbbrev}
        </Link>
      </div>
      <p className="text-xs text-app-faint truncate">{row.teamName}</p>
      <StatRow label="Batting missed RE" value={formatRe(row.battingMissedValue)} highlight={activeSort === "missedRe"} />
      <StatRow label="Fielding missed RE" value={formatRe(row.fieldingMissedValue)} />
      <StatRow label="Bat gained RE" value={formatRe(row.battingGainedRe)} highlight={activeSort === "gainedRe"} />
      <StatRow label="Fld gained RE" value={formatRe(row.fieldingGainedRe)} />
      <StatRow label="Misses" value={String(row.battingMissedCount)} />
      <StatRow label="Challenges" value={String(row.challengesUsed)} />
      <StatRow label="Success %" value={formatRate(row.overturnRate)} highlight={activeSort === "challengeSuccess"} />
    </div>
  );
}

function thClass(active: boolean): string {
  return `px-3 py-2 font-medium text-right whitespace-nowrap${
    active ? " text-emerald-700 dark:text-emerald-300/90" : ""
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
    <div className="rounded-xl border border-app overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-app text-left text-xs text-app-muted uppercase tracking-wider">
              <th className="px-3 py-2 font-medium whitespace-nowrap">#</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Player</th>
              <th className={thClass(activeSort === "missedRe")}>Missed RE</th>
              <th className={thClass(activeSort === "missedRe")}>Bat missed RE</th>
              <th className={thClass(activeSort === "missedRe")}>Fld missed RE</th>
              <th className={thClass(activeSort === "gainedRe")}>Bat gained RE</th>
              <th className={thClass(activeSort === "gainedRe")}>Fld gained RE</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Misses</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Challenges</th>
              <th className={`whitespace-nowrap ${activeSort === "challengeSuccess" ? "px-3 py-2 font-medium text-right text-emerald-700 dark:text-emerald-300/90" : "px-3 py-2 font-medium text-right"}`}>
                Success %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId} className="border-b border-app-subtle app-hover-row">
                <td className="px-3 py-2.5 text-app-muted font-mono text-xs whitespace-nowrap">{row.rank}</td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                  {row.playerName || `Player ${row.playerId}`}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                  activeSort === "missedRe" ? "text-amber-700 dark:text-amber-300" : "text-amber-700/90 dark:text-amber-300/90"
                }`}>
                  {formatRe(row.totalMissedValue)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-700/90 dark:text-amber-300/90">
                  {formatRe(row.battingMissedValue)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-700/90 dark:text-amber-300/90">
                  {formatRe(row.fieldingMissedValue)}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                  activeSort === "gainedRe" ? "text-emerald-700 dark:text-emerald-300" : "text-emerald-700/80 dark:text-emerald-300/80"
                }`}>
                  {formatRe(row.battingGainedRe)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-700/80 dark:text-emerald-300/80">
                  {formatRe(row.fieldingGainedRe)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{row.missedOpportunities}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{row.challengesUsed}</td>
                <td className={`px-3 py-2.5 text-right whitespace-nowrap ${
                  activeSort === "challengeSuccess" ? "text-app font-medium" : "text-app-secondary"
                }`}>
                  {formatRate(row.overturnRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="rounded-xl border border-app overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-app text-left text-xs text-app-muted uppercase tracking-wider">
              <th className="px-3 py-2 font-medium whitespace-nowrap">#</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Team</th>
              <th className={thClass(activeSort === "missedRe")}>Batting missed RE</th>
              <th className={thClass(activeSort === "missedRe")}>Fielding missed RE</th>
              <th className={thClass(activeSort === "gainedRe")}>Bat gained RE</th>
              <th className={thClass(activeSort === "gainedRe")}>Fld gained RE</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Misses</th>
              <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Challenges</th>
              <th className={`whitespace-nowrap ${activeSort === "challengeSuccess" ? "px-3 py-2 font-medium text-right text-emerald-700 dark:text-emerald-300/90" : "px-3 py-2 font-medium text-right"}`}>
                Success %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-app-subtle app-hover-row">
                <td className="px-3 py-2.5 text-app-muted font-mono text-xs whitespace-nowrap">{row.rank}</td>
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                  <Link to="/" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                    {row.teamAbbrev}
                  </Link>
                  <span className="text-app-faint text-xs ml-2">{row.teamName}</span>
                </td>
                <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                  activeSort === "missedRe" ? "text-amber-700 dark:text-amber-300" : "text-amber-700/90 dark:text-amber-300/90"
                }`}>
                  {formatRe(row.battingMissedValue)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-700/90 dark:text-amber-300/90">
                  {formatRe(row.fieldingMissedValue)}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                  activeSort === "gainedRe" ? "text-emerald-700 dark:text-emerald-300" : "text-emerald-700/80 dark:text-emerald-300/80"
                }`}>
                  {formatRe(row.battingGainedRe)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-700/80 dark:text-emerald-300/80">
                  {formatRe(row.fieldingGainedRe)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{row.battingMissedCount}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{row.challengesUsed}</td>
                <td className={`px-3 py-2.5 text-right whitespace-nowrap ${
                  activeSort === "challengeSuccess" ? "text-app font-medium" : "text-app-secondary"
                }`}>
                  {formatRate(row.overturnRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
