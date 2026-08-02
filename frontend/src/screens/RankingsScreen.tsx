import { Link } from "react-router-dom";
import type {
  PlayerRankingRow,
  RankingsLeaderboardSort,
  RankingsSide,
  TeamRankingRow,
} from "../api/types";
import { SegmentedControl } from "../components/ui/SegmentedControl";
import { LoadingText } from "../components/ui/LoadingSkeleton";
import { orderLabel, useRankings } from "../hooks/useRankings";
import { formatRe, formatSuccessRate } from "../utils/format";

const ALL_PLAYER_SORT_OPTIONS: { value: RankingsLeaderboardSort; label: string }[] = [
  { value: "name", label: "Player" },
  { value: "missedRe", label: "Missed RE" },
  { value: "battingMissedRe", label: "Bat missed RE" },
  { value: "fieldingMissedRe", label: "Fld missed RE" },
  { value: "gainedRe", label: "Gained RE" },
  { value: "battingGainedRe", label: "Bat gained RE" },
  { value: "fieldingGainedRe", label: "Fld gained RE" },
  { value: "misses", label: "Misses" },
  { value: "challenges", label: "Challenges" },
  { value: "challengeSuccess", label: "Success %" },
];

const SIDE_PLAYER_SORT_OPTIONS: {
  batting: { value: RankingsLeaderboardSort; label: string }[];
  fielding: { value: RankingsLeaderboardSort; label: string }[];
} = {
  batting: [
    { value: "name", label: "Player" },
    { value: "battingMissedRe", label: "Missed RE" },
    { value: "battingGainedRe", label: "Gained RE" },
    { value: "misses", label: "Misses" },
    { value: "challenges", label: "Challenges" },
    { value: "challengeSuccess", label: "Success %" },
  ],
  fielding: [
    { value: "name", label: "Player" },
    { value: "fieldingMissedRe", label: "Missed RE" },
    { value: "fieldingGainedRe", label: "Gained RE" },
    { value: "misses", label: "Misses" },
    { value: "challenges", label: "Challenges" },
    { value: "challengeSuccess", label: "Success %" },
  ],
};

function mobileSortOptions(
  view: "players" | "teams",
  side: RankingsSide
): { value: RankingsLeaderboardSort; label: string }[] {
  const nameLabel = view === "players" ? "Player" : "Team";
  if (side === "all") {
    return ALL_PLAYER_SORT_OPTIONS.map((opt) =>
      opt.value === "name" ? { ...opt, label: nameLabel } : opt
    );
  }
  return SIDE_PLAYER_SORT_OPTIONS[side].map((opt) =>
    opt.value === "name" ? { ...opt, label: nameLabel } : opt
  );
}

export function RankingsScreen() {
  const {
    view,
    period,
    side,
    sort,
    order,
    meta,
    loading,
    error,
    sortedPlayerRows,
    sortedTeamRows,
    setViewAndSync,
    setPeriodAndSync,
    setSideAndSync,
    cycleSortColumn,
    selectSortColumn,
  } = useRankings();

  const displayedRows = view === "players" ? sortedPlayerRows : sortedTeamRows;
  const sortOptions = mobileSortOptions(view, side);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Rankings</h1>
        <p className="text-sm text-app-muted mt-1 leading-relaxed">
          Click a column header to sort; click again to flip high ↔ low.
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
        <SegmentedControl
          value={side}
          options={[
            { value: "all", label: "All" },
            { value: "batting", label: "Batting" },
            { value: "fielding", label: "Fielding" },
          ]}
          onChange={setSideAndSync}
        />
      </div>

      {/* Mobile: no table headers — pick a column to sort */}
      <div className="sm:hidden flex flex-wrap items-center gap-2">
        <label className="text-xs text-app-muted" htmlFor="rankings-sort">
          Sort by
        </label>
        <select
          id="rankings-sort"
          className="rounded-lg border border-app app-surface-subtle bg-transparent text-sm text-app px-3 py-2 min-h-11"
          value={sort}
          onChange={(e) => selectSortColumn(e.target.value as RankingsLeaderboardSort)}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-app app-surface-subtle text-sm px-3 py-2 min-h-11 text-app"
          onClick={() => cycleSortColumn(sort)}
        >
          {order === "desc" ? "High → Low" : "Low → High"}
        </button>
      </div>

      {meta && (
        <p className="text-xs text-app-muted font-mono">
          {meta.periodLabel}
          {meta.gameCount > 0 && ` · ${meta.gameCount} tracked games`}
          {side !== "all" && ` · ${side}`}
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
              <PlayerCard key={row.playerId} row={row} activeSort={sort} side={side} />
            ))}
          </div>
          <div className="hidden sm:block">
            <PlayerTable
              rows={sortedPlayerRows}
              activeSort={sort}
              order={order}
              side={side}
              onSort={cycleSortColumn}
            />
          </div>
        </>
      )}

      {!loading && !error && displayedRows.length > 0 && view === "teams" && (
        <>
          <div className="sm:hidden space-y-2">
            {sortedTeamRows.map((row) => (
              <TeamCard key={row.teamId} row={row} activeSort={sort} side={side} />
            ))}
          </div>
          <div className="hidden sm:block">
            <TeamTable
              rows={sortedTeamRows}
              activeSort={sort}
              order={order}
              side={side}
              onSort={cycleSortColumn}
            />
          </div>
        </>
      )}

      <p className="text-[11px] text-app-faint leading-relaxed">
        Missed RE = postgame audit run expectancy left on the table (batting → batter,
        fielding → catcher). Gained RE = run expectancy from successful overturns.
        Challenge success % = overturned ÷ challenges used for challenges actually taken
        (batting and fielding combined, even when the Batting/Fielding filter is on) —
        separate from missed opportunities, which are challenges never used.
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

function PlayerCard({
  row,
  activeSort,
  side,
}: {
  row: PlayerRankingRow;
  activeSort: RankingsLeaderboardSort;
  side: RankingsSide;
}) {
  const missed =
    side === "batting"
      ? row.battingMissedValue
      : side === "fielding"
        ? row.fieldingMissedValue
        : row.totalMissedValue;
  const gained =
    side === "batting"
      ? row.battingGainedRe
      : side === "fielding"
        ? row.fieldingGainedRe
        : row.totalGainedRe;
  const misses =
    side === "batting"
      ? row.battingMissedCount
      : side === "fielding"
        ? row.fieldingMissedCount
        : row.missedOpportunities;
  const missedSort: RankingsLeaderboardSort =
    side === "batting" ? "battingMissedRe" : side === "fielding" ? "fieldingMissedRe" : "missedRe";
  const gainedSort: RankingsLeaderboardSort =
    side === "batting" ? "battingGainedRe" : side === "fielding" ? "fieldingGainedRe" : "gainedRe";

  return (
    <div className="rounded-xl border border-app app-surface-subtle px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-mono text-app-faint">#{row.rank}</span>
        <p className="font-medium text-app truncate flex-1">{row.playerName || `Player ${row.playerId}`}</p>
      </div>
      <StatRow label="Missed RE" value={formatRe(missed)} highlight={activeSort === missedSort} />
      {side === "all" && (
        <>
          <StatRow label="Bat missed RE" value={formatRe(row.battingMissedValue)} highlight={activeSort === "battingMissedRe"} />
          <StatRow label="Fld missed RE" value={formatRe(row.fieldingMissedValue)} highlight={activeSort === "fieldingMissedRe"} />
        </>
      )}
      <StatRow label="Gained RE" value={formatRe(gained)} highlight={activeSort === gainedSort} />
      {side === "all" && (
        <>
          <StatRow label="Bat gained RE" value={formatRe(row.battingGainedRe)} highlight={activeSort === "battingGainedRe"} />
          <StatRow label="Fld gained RE" value={formatRe(row.fieldingGainedRe)} highlight={activeSort === "fieldingGainedRe"} />
        </>
      )}
      <StatRow label="Misses" value={String(misses)} highlight={activeSort === "misses"} />
      <StatRow label="Challenges" value={String(row.challengesUsed)} highlight={activeSort === "challenges"} />
      <StatRow
        label="Success %"
        value={formatSuccessRate(row.overturnRate, row.challengesOverturned, row.challengesUsed)}
        highlight={activeSort === "challengeSuccess"}
      />
    </div>
  );
}

function TeamCard({
  row,
  activeSort,
  side,
}: {
  row: TeamRankingRow;
  activeSort: RankingsLeaderboardSort;
  side: RankingsSide;
}) {
  const missed =
    side === "batting"
      ? row.battingMissedValue
      : side === "fielding"
        ? row.fieldingMissedValue
        : row.totalMissedValue;
  const gained =
    side === "batting"
      ? row.battingGainedRe
      : side === "fielding"
        ? row.fieldingGainedRe
        : row.totalGainedRe;
  const misses =
    side === "batting"
      ? row.battingMissedCount
      : side === "fielding"
        ? row.fieldingMissedCount
        : row.battingMissedCount + row.fieldingMissedCount;
  const missedSort: RankingsLeaderboardSort =
    side === "batting" ? "battingMissedRe" : side === "fielding" ? "fieldingMissedRe" : "missedRe";
  const gainedSort: RankingsLeaderboardSort =
    side === "batting" ? "battingGainedRe" : side === "fielding" ? "fieldingGainedRe" : "gainedRe";

  return (
    <div className="rounded-xl border border-app app-surface-subtle px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-mono text-app-faint">#{row.rank}</span>
        <Link to="/" className="font-medium text-app hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
          {row.teamAbbrev}
        </Link>
      </div>
      <p className="text-xs text-app-faint truncate">{row.teamName}</p>
      <StatRow label="Missed RE" value={formatRe(missed)} highlight={activeSort === missedSort} />
      {side === "all" && (
        <>
          <StatRow label="Batting missed RE" value={formatRe(row.battingMissedValue)} highlight={activeSort === "battingMissedRe"} />
          <StatRow label="Fielding missed RE" value={formatRe(row.fieldingMissedValue)} highlight={activeSort === "fieldingMissedRe"} />
        </>
      )}
      <StatRow label="Gained RE" value={formatRe(gained)} highlight={activeSort === gainedSort} />
      {side === "all" && (
        <>
          <StatRow label="Bat gained RE" value={formatRe(row.battingGainedRe)} highlight={activeSort === "battingGainedRe"} />
          <StatRow label="Fld gained RE" value={formatRe(row.fieldingGainedRe)} highlight={activeSort === "fieldingGainedRe"} />
        </>
      )}
      <StatRow label="Misses" value={String(misses)} highlight={activeSort === "misses"} />
      <StatRow label="Challenges" value={String(row.challengesUsed)} highlight={activeSort === "challenges"} />
      <StatRow
        label="Success %"
        value={formatSuccessRate(row.overturnRate, row.challengesOverturned, row.challengesUsed)}
        highlight={activeSort === "challengeSuccess"}
      />
    </div>
  );
}

function SortableTh({
  label,
  column,
  activeSort,
  order,
  onSort,
  align = "right",
}: {
  label: string;
  column: RankingsLeaderboardSort;
  activeSort: RankingsLeaderboardSort;
  order: "asc" | "desc";
  onSort: (column: RankingsLeaderboardSort) => void;
  align?: "left" | "right";
}) {
  const active = activeSort === column;
  const arrow = !active ? "" : order === "desc" ? " ↓" : " ↑";
  return (
    <th
      className={`px-3 py-2 font-medium whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }${active ? " text-emerald-700 dark:text-emerald-300/90" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-0.5 min-h-11 -my-2 py-2 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        aria-label={`Sort by ${label}${active ? `, currently ${order === "desc" ? "descending" : "ascending"}` : ""}`}
      >
        {label}
        <span className="font-mono text-[10px] w-3 inline-block">{arrow || "\u00a0"}</span>
      </button>
    </th>
  );
}

function cellClass(active: boolean, tone: "amber" | "emerald" | "neutral"): string {
  if (tone === "amber") {
    return active
      ? "text-amber-700 dark:text-amber-300"
      : "text-amber-700/90 dark:text-amber-300/90";
  }
  if (tone === "emerald") {
    return active
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-emerald-700/80 dark:text-emerald-300/80";
  }
  return active ? "text-app font-medium" : "text-app-secondary";
}

function PlayerTable({
  rows,
  activeSort,
  order,
  side,
  onSort,
}: {
  rows: PlayerRankingRow[];
  activeSort: RankingsLeaderboardSort;
  order: "asc" | "desc";
  side: RankingsSide;
  onSort: (column: RankingsLeaderboardSort) => void;
}) {
  const showAll = side === "all";
  const missedCol: RankingsLeaderboardSort =
    side === "batting" ? "battingMissedRe" : side === "fielding" ? "fieldingMissedRe" : "missedRe";
  const gainedCol: RankingsLeaderboardSort =
    side === "batting" ? "battingGainedRe" : side === "fielding" ? "fieldingGainedRe" : "gainedRe";

  return (
    <div className="rounded-xl border border-app overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${showAll ? "min-w-[980px]" : "min-w-[640px]"}`}>
          <thead>
            <tr className="border-b border-app text-left text-xs text-app-muted uppercase tracking-wider">
              <th className="px-3 py-2 font-medium whitespace-nowrap">#</th>
              <SortableTh label="Player" column="name" activeSort={activeSort} order={order} onSort={onSort} align="left" />
              <SortableTh label="Missed RE" column={missedCol} activeSort={activeSort} order={order} onSort={onSort} />
              {showAll && (
                <>
                  <SortableTh label="Bat missed" column="battingMissedRe" activeSort={activeSort} order={order} onSort={onSort} />
                  <SortableTh label="Fld missed" column="fieldingMissedRe" activeSort={activeSort} order={order} onSort={onSort} />
                </>
              )}
              <SortableTh label="Gained RE" column={gainedCol} activeSort={activeSort} order={order} onSort={onSort} />
              {showAll && (
                <>
                  <SortableTh label="Bat gained" column="battingGainedRe" activeSort={activeSort} order={order} onSort={onSort} />
                  <SortableTh label="Fld gained" column="fieldingGainedRe" activeSort={activeSort} order={order} onSort={onSort} />
                </>
              )}
              <SortableTh label="Misses" column="misses" activeSort={activeSort} order={order} onSort={onSort} />
              <SortableTh label="Challenges" column="challenges" activeSort={activeSort} order={order} onSort={onSort} />
              <SortableTh label="Success %" column="challengeSuccess" activeSort={activeSort} order={order} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const missed =
                side === "batting"
                  ? row.battingMissedValue
                  : side === "fielding"
                    ? row.fieldingMissedValue
                    : row.totalMissedValue;
              const gained =
                side === "batting"
                  ? row.battingGainedRe
                  : side === "fielding"
                    ? row.fieldingGainedRe
                    : row.totalGainedRe;
              const misses =
                side === "batting"
                  ? row.battingMissedCount
                  : side === "fielding"
                    ? row.fieldingMissedCount
                    : row.missedOpportunities;
              return (
                <tr key={row.playerId} className="border-b border-app-subtle app-hover-row">
                  <td className="px-3 py-2.5 text-app-muted font-mono text-xs whitespace-nowrap">{row.rank}</td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {row.playerName || `Player ${row.playerId}`}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === missedCol, "amber")}`}>
                    {formatRe(missed)}
                  </td>
                  {showAll && (
                    <>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "battingMissedRe", "amber")}`}>
                        {formatRe(row.battingMissedValue)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "fieldingMissedRe", "amber")}`}>
                        {formatRe(row.fieldingMissedValue)}
                      </td>
                    </>
                  )}
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === gainedCol, "emerald")}`}>
                    {formatRe(gained)}
                  </td>
                  {showAll && (
                    <>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "battingGainedRe", "emerald")}`}>
                        {formatRe(row.battingGainedRe)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "fieldingGainedRe", "emerald")}`}>
                        {formatRe(row.fieldingGainedRe)}
                      </td>
                    </>
                  )}
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "misses", "neutral")}`}>
                    {misses}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "challenges", "neutral")}`}>
                    {row.challengesUsed}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "challengeSuccess", "neutral")}`}>
                    {formatSuccessRate(row.overturnRate, row.challengesOverturned, row.challengesUsed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamTable({
  rows,
  activeSort,
  order,
  side,
  onSort,
}: {
  rows: TeamRankingRow[];
  activeSort: RankingsLeaderboardSort;
  order: "asc" | "desc";
  side: RankingsSide;
  onSort: (column: RankingsLeaderboardSort) => void;
}) {
  const showAll = side === "all";
  const missedCol: RankingsLeaderboardSort =
    side === "batting" ? "battingMissedRe" : side === "fielding" ? "fieldingMissedRe" : "missedRe";
  const gainedCol: RankingsLeaderboardSort =
    side === "batting" ? "battingGainedRe" : side === "fielding" ? "fieldingGainedRe" : "gainedRe";

  return (
    <div className="rounded-xl border border-app overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${showAll ? "min-w-[980px]" : "min-w-[640px]"}`}>
          <thead>
            <tr className="border-b border-app text-left text-xs text-app-muted uppercase tracking-wider">
              <th className="px-3 py-2 font-medium whitespace-nowrap">#</th>
              <SortableTh label="Team" column="name" activeSort={activeSort} order={order} onSort={onSort} align="left" />
              <SortableTh label="Missed RE" column={missedCol} activeSort={activeSort} order={order} onSort={onSort} />
              {showAll && (
                <>
                  <SortableTh label="Bat missed" column="battingMissedRe" activeSort={activeSort} order={order} onSort={onSort} />
                  <SortableTh label="Fld missed" column="fieldingMissedRe" activeSort={activeSort} order={order} onSort={onSort} />
                </>
              )}
              <SortableTh label="Gained RE" column={gainedCol} activeSort={activeSort} order={order} onSort={onSort} />
              {showAll && (
                <>
                  <SortableTh label="Bat gained" column="battingGainedRe" activeSort={activeSort} order={order} onSort={onSort} />
                  <SortableTh label="Fld gained" column="fieldingGainedRe" activeSort={activeSort} order={order} onSort={onSort} />
                </>
              )}
              <SortableTh label="Misses" column="misses" activeSort={activeSort} order={order} onSort={onSort} />
              <SortableTh label="Challenges" column="challenges" activeSort={activeSort} order={order} onSort={onSort} />
              <SortableTh label="Success %" column="challengeSuccess" activeSort={activeSort} order={order} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const missed =
                side === "batting"
                  ? row.battingMissedValue
                  : side === "fielding"
                    ? row.fieldingMissedValue
                    : row.totalMissedValue;
              const gained =
                side === "batting"
                  ? row.battingGainedRe
                  : side === "fielding"
                    ? row.fieldingGainedRe
                    : row.totalGainedRe;
              const misses =
                side === "batting"
                  ? row.battingMissedCount
                  : side === "fielding"
                    ? row.fieldingMissedCount
                    : row.battingMissedCount + row.fieldingMissedCount;
              return (
                <tr key={row.teamId} className="border-b border-app-subtle app-hover-row">
                  <td className="px-3 py-2.5 text-app-muted font-mono text-xs whitespace-nowrap">{row.rank}</td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    <Link to="/" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                      {row.teamAbbrev}
                    </Link>
                    <span className="text-app-faint text-xs ml-2">{row.teamName}</span>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === missedCol, "amber")}`}>
                    {formatRe(missed)}
                  </td>
                  {showAll && (
                    <>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "battingMissedRe", "amber")}`}>
                        {formatRe(row.battingMissedValue)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "fieldingMissedRe", "amber")}`}>
                        {formatRe(row.fieldingMissedValue)}
                      </td>
                    </>
                  )}
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === gainedCol, "emerald")}`}>
                    {formatRe(gained)}
                  </td>
                  {showAll && (
                    <>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "battingGainedRe", "emerald")}`}>
                        {formatRe(row.battingGainedRe)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${cellClass(activeSort === "fieldingGainedRe", "emerald")}`}>
                        {formatRe(row.fieldingGainedRe)}
                      </td>
                    </>
                  )}
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "misses", "neutral")}`}>
                    {misses}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "challenges", "neutral")}`}>
                    {row.challengesUsed}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap ${cellClass(activeSort === "challengeSuccess", "neutral")}`}>
                    {formatSuccessRate(row.overturnRate, row.challengesOverturned, row.challengesUsed)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
