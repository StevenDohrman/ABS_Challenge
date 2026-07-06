import { useCallback, useEffect, useState } from "react";
import {
  fetchLatestRecommendation,
  fetchCurrentAtBatGrid,
  fetchGameAtBatHistory,
  fetchPostgameAudit,
} from "../api/client";
import type {
  ChallengeRecommendationResponse,
  AtBatRecommendationGridResponse,
  GameAtBatHistoryResponse,
  PostgameAuditResponse,
} from "../api/types";
import { useInterval } from "./useInterval";

const LIVE_PITCH_POLL_MS = 5_000;
const PRE_BAT_POLL_MS = 8_000;
const HISTORY_POLL_MS = 15_000;
const AUDIT_POLL_MS = 30_000;

interface UseGameDetailDataOptions {
  gamePk: number;
  isLive: boolean;
  isFinal: boolean;
  isTracked: boolean;
}

export function useGameDetailData({
  gamePk,
  isLive,
  isFinal,
  isTracked,
}: UseGameDetailDataOptions) {
  const [livePitch, setLivePitch] = useState<ChallengeRecommendationResponse | null>(null);
  const [preBat, setPreBat] = useState<AtBatRecommendationGridResponse | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [liveLastUpdated, setLiveLastUpdated] = useState<Date | null>(null);

  const [history, setHistory] = useState<GameAtBatHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [postgameAudit, setPostgameAudit] = useState<PostgameAuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const pollLivePitch = useCallback(async () => {
    const result = await fetchLatestRecommendation(gamePk);
    if (result.status === "ok") setLivePitch(result.data);
    else if (result.status === "no_content") setLivePitch(null);
    setLiveLastUpdated(new Date());
  }, [gamePk]);

  const pollPreBat = useCallback(async () => {
    const result = await fetchCurrentAtBatGrid(gamePk);
    if (result.status === "ok") setPreBat(result.data);
    else if (result.status === "no_content") setPreBat(null);
  }, [gamePk]);

  const loadHistory = useCallback(async () => {
    if (!isTracked && !isFinal) return;
    setHistoryLoading(true);
    const result = await fetchGameAtBatHistory(gamePk);
    if (result.status === "ok") setHistory(result.data);
    setHistoryLoading(false);
  }, [gamePk, isTracked, isFinal]);

  const loadPostgameAudit = useCallback(async () => {
    if (!isFinal) return;
    setAuditLoading(true);
    const result = await fetchPostgameAudit(gamePk);
    if (result.status === "ok") setPostgameAudit(result.data);
    setAuditLoading(false);
  }, [gamePk, isFinal]);

  useInterval(pollLivePitch, LIVE_PITCH_POLL_MS, isLive);
  useInterval(pollPreBat, PRE_BAT_POLL_MS, isLive);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);
  useInterval(loadHistory, HISTORY_POLL_MS, isLive, false);

  useEffect(() => {
    void loadPostgameAudit();
  }, [loadPostgameAudit]);
  useInterval(
    () => {
      if (postgameAudit?.status === "ready") return;
      void loadPostgameAudit();
    },
    AUDIT_POLL_MS,
    isFinal && postgameAudit?.status !== "ready",
    false
  );

  return {
    livePitch,
    preBat,
    showGrid,
    setShowGrid,
    liveLastUpdated,
    history,
    historyLoading,
    postgameAudit,
    auditLoading,
  };
}
