import { useCallback, useEffect, useState } from "react";
import { fetchTodaySchedule } from "../api/client";
import type { ScheduleGame } from "../api/types";
import { mlbToday } from "../utils/scheduleDates";
import { useInterval } from "./useInterval";

const SCHEDULE_REFRESH_MS = 30_000;

export function useScheduleGame(gamePk: number, scheduleDate?: string) {
  const [game, setGame] = useState<ScheduleGame | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchTodaySchedule(scheduleDate);
    if (result.status === "ok") {
      const found = result.data.games.find((g) => g.gamePk === gamePk);
      setGame(found ?? null);
    }
    setLoading(false);
  }, [gamePk, scheduleDate]);

  const isHistoricalDate = scheduleDate != null && scheduleDate !== mlbToday();

  useEffect(() => {
    if (isNaN(gamePk)) return;
    void refresh();
  }, [gamePk, refresh]);

  useInterval(refresh, SCHEDULE_REFRESH_MS, !isNaN(gamePk) && !isHistoricalDate, false);

  return { game, loading };
}

export function useSchedule(date?: string) {
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const isToday = date == null || date === mlbToday();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchTodaySchedule(date);
    if (result.status === "ok") {
      setGames(result.data.games);
      setScheduleDate(result.data.date);
      setError(null);
      setLastRefresh(new Date());
    } else if (result.status === "error") {
      setError(result.message);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useInterval(load, SCHEDULE_REFRESH_MS, isToday, false);

  return { games, scheduleDate, loading, error, lastRefresh, reload: load };
}
