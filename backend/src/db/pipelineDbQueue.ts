/**
 * Priority queues for live-pipeline DB work.
 *
 *   high — live atBatStart + pitch events (must stay responsive)
 *   low  — mid-game historical backfill batches (can run in background)
 *
 * Both queues may have one job in flight at a time on their respective tails,
 * but dbGate caps total concurrent Prisma queries process-wide.
 */

export type PipelineDbPriority = "high" | "low";

let highTail: Promise<void> = Promise.resolve();
let lowTail: Promise<void> = Promise.resolve();

/** In-flight backfill batches keyed by gamePk. Live handlers await these. */
const backfillByGame = new Map<number, Promise<void>>();

/** Resolves once called-strike at-bats are pre-computed; pitch replay waits on this. */
const backfillPitchReadyByGame = new Map<number, Promise<void>>();

/**
 * Register a backfill batch so live atBatStart / pitchEvent handlers for the
 * same game wait until snapshots are ingested and pre-computed.
 */
export function trackGameBackfill(gamePk: number, work: Promise<void>): void {
  backfillByGame.set(gamePk, work);
  void work.finally(() => {
    if (backfillByGame.get(gamePk) === work) {
      backfillByGame.delete(gamePk);
    }
  });
}

/** Wait for an in-progress backfill on this game, if any. */
export async function waitForGameBackfill(gamePk: number): Promise<void> {
  await (backfillByGame.get(gamePk) ?? Promise.resolve());
}

/**
 * Register the pitch-replay gate for a backfill batch. Pitch handlers should
 * wait on this instead of the full backfill when historical replay is pending.
 */
export function trackGameBackfillPitchReady(
  gamePk: number,
  promise: Promise<void>
): void {
  backfillPitchReadyByGame.set(gamePk, promise);
  void promise.finally(() => {
    if (backfillPitchReadyByGame.get(gamePk) === promise) {
      backfillPitchReadyByGame.delete(gamePk);
    }
  });
}

/** Wait until called-strike at-bats are pre-computed for this game, if backfill is running. */
export async function waitForGameBackfillPitchReady(gamePk: number): Promise<void> {
  await (backfillPitchReadyByGame.get(gamePk) ?? Promise.resolve());
}

/** True when a live mid-game backfill batch is running for this game. */
export function isLiveGameBackfillInProgress(gamePk: number): boolean {
  return backfillByGame.has(gamePk);
}

/** Wait for any in-progress live ingest work on this game. */
export async function waitForGameIngest(gamePk: number): Promise<void> {
  await waitForGameBackfill(gamePk);
}

/**
 * Enqueue pipeline DB work on the high or low priority queue.
 * Failures are logged but do not block subsequent jobs on that queue.
 */
export async function enqueuePipelineDbWork<T>(
  label: string,
  fn: () => Promise<T>,
  priority: PipelineDbPriority = "high"
): Promise<T> {
  const prior = priority === "high" ? highTail : lowTail;

  const work = prior.then(async () => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[pipelineDbQueue] ${label} failed:`, err);
      throw err;
    }
  });

  const tailUpdate = work.then(
    () => undefined,
    () => undefined
  );

  if (priority === "high") {
    highTail = tailUpdate;
  } else {
    lowTail = tailUpdate;
  }

  return work;
}
