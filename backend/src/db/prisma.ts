import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client.
 *
 * Prisma opens a connection pool when the first query runs. Sharing a single
 * instance across the process avoids exhausting the database connection limit,
 * which is especially important with Supabase's pooler-based limits.
 *
 * The global check prevents hot-reload tools (ts-node-dev, nodemon) from
 * creating a new client on every file change during development.
 */

/**
 * How long (seconds) a query will wait for a free connection before Prisma
 * throws P2024. Bulk writes are concurrency-capped (DB_LIMITS.WRITE_CONCURRENCY)
 * so the pool should not saturate, but a slightly larger timeout than Prisma's
 * 10s default rides out brief contention spikes — e.g. the daily Savant rerun
 * overlapping a burst of live-poll writes — instead of dropping queries.
 */
const POOL_TIMEOUT_SECONDS = 20;

/**
 * Append pool-tuning params to DATABASE_URL without overriding anything the
 * operator set explicitly. Returns undefined when no URL is configured (e.g.
 * unit tests), in which case Prisma falls back to the schema's env() binding.
 */
function buildDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(POOL_TIMEOUT_SECONDS));
    }
    return url.toString();
  } catch {
    // Unparseable URL — leave it untouched and let Prisma surface the error.
    return base;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url = buildDatasourceUrl();
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const prisma: PrismaClient = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
