import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchRankingsBundle } from "../api/client";
import type {
  PlayerRankingRow,
  RankingsLeaderboardSort,
  RankingsPeriod,
  RankingsSortOrder,
  TeamRankingRow,
} from "../api/types";
import { sortPlayerRows, sortTeamRows } from "../utils/rankingsSort";

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
  if (value === "challengeSuccess") return "challengeSuccess";
  if (value === "gainedRe") return "gainedRe";
  return "missedRe";
}

function parseOrder(value: string | null): RankingsSortOrder {
  return value === "asc" ? "asc" : "desc";
}

export function useRankings() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "teams" ? "teams" : "players"
  );
  const [period, setPeriod] = useState<RankingsPeriod>(
    searchParams.get("period") === "season" ? "season" : "week"
  );
  const [sort, setSort] = useState<RankingsLeaderboardSort>(
    parseSort(searchParams.get("sort"))
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
      nextSort: RankingsLeaderboardSort,
      nextOrder: RankingsSortOrder
    ) => {
      const params: Record<string, string> = {};
      if (nextView === "teams") params.view = "teams";
      if (nextPeriod === "season") params.period = "season";
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
    () => sortPlayerRows(playerRows, sort, order),
    [playerRows, sort, order]
  );

  const sortedTeamRows = useMemo(
    () => sortTeamRows(teamRows, sort, order),
    [teamRows, sort, order]
  );

  const setViewAndSync = (next: ViewMode) => {
    setView(next);
    syncParams(next, period, sort, order);
  };

  const setPeriodAndSync = (next: RankingsPeriod) => {
    setPeriod(next);
    syncParams(view, next, sort, order);
  };

  const setSortAndSync = (next: RankingsLeaderboardSort) => {
    setSort(next);
    syncParams(view, period, next, order);
  };

  const setOrderAndSync = (next: RankingsSortOrder) => {
    setOrder(next);
    syncParams(view, period, sort, next);
  };

  return {
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
  };
}

export function orderLabel(sort: RankingsLeaderboardSort, order: RankingsSortOrder): string {
  if (sort === "missedRe") {
    return order === "desc" ? "Highest missed RE first" : "Lowest missed RE first";
  }
  if (sort === "gainedRe") {
    return order === "desc" ? "Most gained RE first" : "Least gained RE first";
  }
  return order === "desc" ? "Best success % first" : "Worst success % first";
}
