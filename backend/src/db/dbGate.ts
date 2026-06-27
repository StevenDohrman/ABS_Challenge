/**
 * Central DB concurrency gate.
 *
 * Every Prisma query passes through this semaphore (see prisma.ts). It caps how
 * many queries are in flight at once so bulk writes + live poll handlers + API
 * requests cannot exhaust the Prisma connection pool (P2024).
 *
 * This is separate from DB_LIMITS.WRITE_CONCURRENCY, which only caps fan-out
 * inside a single batch (e.g. 12 recommendation upserts). The gate limits
 * total concurrent queries process-wide.
 */

import { DB_LIMITS } from "./constants";

export interface DbGateStats {
  /** Queries currently executing. */
  inFlight: number;
  /** Queries waiting for a slot. */
  waiting: number;
  /** Highest inFlight observed since process start. */
  maxInFlight: number;
  /** Total queries that acquired a slot. */
  totalAcquired: number;
  /** Total queries that had to wait for a slot. */
  totalWaited: number;
}

let inFlight = 0;
let maxInFlight = 0;
let totalAcquired = 0;
let totalWaited = 0;
const waitQueue: Array<() => void> = [];

export function getDbGateStats(): DbGateStats {
  return {
    inFlight,
    waiting: waitQueue.length,
    maxInFlight,
    totalAcquired,
    totalWaited,
  };
}

/** Acquire one query slot. Waits when MAX_CONCURRENT_QUERIES are in use. */
export async function acquireDbSlot(): Promise<void> {
  if (inFlight < DB_LIMITS.MAX_CONCURRENT_QUERIES) {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    totalAcquired++;
    return;
  }

  totalWaited++;
  const waitStart = Date.now();

  await new Promise<void>((resolve) => {
    waitQueue.push(() => {
      const waitMs = Date.now() - waitStart;
      if (waitMs >= DB_LIMITS.GATE_WARN_WAIT_MS) {
        console.warn(
          `[dbGate] query waited ${waitMs}ms for a slot ` +
            `(inFlight=${inFlight}, queued=${waitQueue.length}, max=${DB_LIMITS.MAX_CONCURRENT_QUERIES})`
        );
      }
      resolve();
    });
  });

  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  totalAcquired++;
}

/** Release a query slot and wake the next waiter, if any. */
export function releaseDbSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/** Run arbitrary work while holding one query slot (for non-Prisma use). */
export async function runWithDbSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireDbSlot();
  try {
    return await fn();
  } finally {
    releaseDbSlot();
  }
}
