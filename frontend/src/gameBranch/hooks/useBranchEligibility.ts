import { useCallback, useEffect, useState } from "react";
import type { BranchEligibility } from "../state/branchTypes";
import { fetchBranchEligibility } from "../api/branchClient";

const POLL_MS = 30_000;

export function useBranchEligibility(gamePk: number) {
  const [eligibility, setEligibility] = useState<BranchEligibility | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!Number.isFinite(gamePk)) return;
    setLoading(true);
    const result = await fetchBranchEligibility(gamePk);
    if (result.status === "ok") setEligibility(result.data);
    setLoading(false);
  }, [gamePk]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { eligibility, loading, refresh };
}
