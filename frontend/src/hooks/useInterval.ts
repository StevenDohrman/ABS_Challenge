import { useEffect, useRef } from "react";

/**
 * Calls `callback` on a fixed interval when enabled.
 * @param immediate Run once when the effect starts (default true).
 */
export function useInterval(
  callback: () => void | Promise<void>,
  intervalMs: number | null,
  enabled = true,
  immediate = true
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs === null) return;

    if (immediate) void savedCallback.current();
    const id = setInterval(() => void savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, immediate]);
}
