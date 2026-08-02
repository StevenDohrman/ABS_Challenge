import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRankingsBundle } from "../api/client";
import type {
  PlayerRankingRow,
  RankingsLeaderboardSort,
  RankingsPeriod,
  RankingsSide,
  RankingsSortOrder,
  TeamRankingRow,
} from "../api/types";
import {
  coerceSortForSide,
  defaultOrderForSort,
  isRankingsSide,
  isRankingsSortKey,
  nextSortState,
  sortPlayerRows,
  sortTeamRows,
} from "../utils/rankingsSort";

type ViewMode = "players" | "teams";

export interface RankingsMeta {
  period: RankingsPeriod;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  trackingStartDate: string;
  windowDays: number;
  gameCount: number;
}

function parseSort(value: string | null): RankingsLeaderboardSort {
  if (isRankingsSortKey(value)) return value;
  // Legacy URL aliases
  if (value === "totalMissedValue") return "missedRe";
  if (value === "totalGainedRe") return "gainedRe";
  if (value === "overturnRate") return "challengeSuccess";
  return "missedRe";
}

function parseOrder(value: string | null): RankingsSortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseSide(value: string | null): RankingsSide {
  return isRankingsSide(value) ? value : "all";
}

export function useRankings() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "teams" ? "teams" : "players"
  );
  const [period, setPeriod] = useState<RankingsPeriod>(
    searchParams.get("period") === "season" ? "season" : "week"
  );
  const initialSide = parseSide(searchParams.get("side"));
  const [side, setSide] = useState<RankingsSide>(initialSide);
  const [sort, setSort] = useState<RankingsLeaderboardSort>(() =>
    coerceSortForSide(parseSort(searchParams.get("sort")), initialSide)
  );
  const [order, setOrder] = useState<RankingsSortOrder>(
    parseOrder(searchParams.get("order"))
  );

  const [meta, setMeta] = useState<RankingsMeta | null>(null);
  const [playerRows, setPlayerRows] = useState<PlayerRankingRow[]>([]);
  const [teamRows, setTeamRows] = useState<TeamRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncParams = useCallback(
    (
      nextView: ViewMode,
      nextPeriod: RankingsPeriod,
      nextSide: RankingsSide,
      nextSort: RankingsLeaderboardSort,
      nextOrder: RankingsSortOrder
    ) => {
      const params: Record<string, string> = {};
      if (nextView === "teams") params.view = "teams";
      if (nextPeriod === "season") params.period = "season";
      if (nextSide !== "all") params.side = nextSide;
      if (nextSort !== "missedRe") params.sort = nextSort;
      if (nextOrder !== "desc") params.order = nextOrder;
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const load = useCallback(async (activePeriod: RankingsPeriod) => {
    setLoading(true);
    setError(null);

    const result = await fetchRankingsBundle({ period: activePeriod });

    if (result.status !== "ok") {
      setError(result.status === "error" ? result.message : "Failed to load rankings");
      setPlayerRows([]);
      setTeamRows([]);
      setMeta(null);
      setLoading(false);
      return;
    }

    setPlayerRows(result.data.players);
    setTeamRows(result.data.teams);
    setMeta({
      period: result.data.period,
      periodLabel: result.data.periodLabel,
      periodStart: result.data.periodStart,
      periodEnd: result.data.periodEnd,
      trackingStartDate: result.data.trackingStartDate,
      windowDays: result.data.windowDays,
      gameCount: result.data.gameCount,
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const sortedPlayerRows = useMemo(
    () => sortPlayerRows(playerRows, sort, order, side),
    [playerRows, sort, order, side]
  );

  const sortedTeamRows = useMemo(
    () => sortTeamRows(teamRows, sort, order, side),
    [teamRows, sort, order, side]
  );

  const setViewAndSync = (next: ViewMode) => {
    setView(next);
    syncParams(next, period, side, sort, order);
  };

  const setPeriodAndSync = (next: RankingsPeriod) => {
    setPeriod(next);
    syncParams(view, next, side, sort, order);
  };

  const setSideAndSync = (next: RankingsSide) => {
    const nextSort = coerceSortForSide(sort, next);
    setSide(next);
    setSort(nextSort);
    syncParams(view, period, next, nextSort, order);
  };

  const cycleSortColumn = (column: RankingsLeaderboardSort) => {
    const next = nextSortState(sort, order, column);
    setSort(next.sort);
    setOrder(next.order);
    syncParams(view, period, side, next.sort, next.order);
  };

  /** Mobile select: pick a column without flipping when unchanged. */
  const selectSortColumn = (column: RankingsLeaderboardSort) => {
    if (column === sort) return;
    const nextOrder = defaultOrderForSort(column);
    setSort(column);
    setOrder(nextOrder);
    syncParams(view, period, side, column, nextOrder);
  };

  return {
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
  };
}

export function orderLabel(sort: RankingsLeaderboardSort, order: RankingsSortOrder): string {
  const dir = order === "desc" ? "high → low" : "low → high";
  switch (sort) {
    case "name":
      return order === "asc" ? "Name A → Z" : "Name Z → A";
    case "missedRe":
      return `Missed RE ${dir}`;
    case "battingMissedRe":
      return `Bat missed RE ${dir}`;
    case "fieldingMissedRe":
      return `Fld missed RE ${dir}`;
    case "gainedRe":
      return `Gained RE ${dir}`;
    case "battingGainedRe":
      return `Bat gained RE ${dir}`;
    case "fieldingGainedRe":
      return `Fld gained RE ${dir}`;
    case "misses":
      return `Misses ${dir}`;
    case "challenges":
      return `Challenges ${dir}`;
    case "challengeSuccess":
      return order === "desc" ? "Best success % first" : "Worst success % first";
    default:
      return `Sorted ${dir}`;
  }
}
