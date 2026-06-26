/**
 * Concurrency helpers.
 *
 * These exist to keep the number of in-flight database queries below the Prisma
 * connection-pool limit. Firing one promise per item (e.g. `Promise.allSettled`
 * over a few hundred Savant rows) demands far more connections than the pool
 * provides, which produces `P2024` "Timed out fetching a new connection from
 * the connection pool" errors and silently drops the writes that timed out.
 */

/**
 * Run `worker` over every item with at most `concurrency` executions in flight
 * at once, preserving `Promise.allSettled` semantics.
 *
 * Guarantees:
 *   - Every item is processed exactly once.
 *   - Results are returned in the same order as `items`.
 *   - A rejected worker never aborts the batch — its slot is recorded as
 *     `{ status: "rejected", reason }`, exactly like `Promise.allSettled`.
 *
 * This is a drop-in replacement for `Promise.allSettled(items.map(worker))`
 * that caps fan-out instead of launching everything simultaneously.
 */
export async function mapSettledWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  if (items.length === 0) return results;

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index] as T, index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}
