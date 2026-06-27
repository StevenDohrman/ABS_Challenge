import { PrismaClient } from "@prisma/client";
import { acquireDbSlot, releaseDbSlot } from "./dbGate";

/**
 * Singleton Prisma client with a central concurrency gate.
 *
 * All queries pass through dbGate (see dbGate.ts) before hitting the database.
 * This prevents live-poll bulk writes, Savant ingest, and API reads from
 * exhausting the connection pool and surfacing P2024 timeouts.
 *
 * The global check prevents hot-reload tools (ts-node-dev, nodemon) from
 * creating a new client on every file change during development.
 */

/**
 * How long (seconds) a query will wait for a free connection before Prisma
 * throws P2024. Bulk writes are concurrency-capped (DB_LIMITS.WRITE_CONCURRENCY)
 * and all queries are gated (DB_LIMITS.MAX_CONCURRENT_QUERIES) so the pool
 * should not saturate; a slightly larger timeout rides out brief spikes.
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

function createBasePrismaClient(): PrismaClient {
  const url = buildDatasourceUrl();
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });
}

/**
 * Wrap the client so every model operation acquires a dbGate slot first.
 * Cast back to PrismaClient so repositories keep their existing types.
 */
function createGatedPrismaClient(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await acquireDbSlot();
          try {
            return await query(args);
          } finally {
            releaseDbSlot();
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

function createPrismaClient(): PrismaClient {
  return createGatedPrismaClient(createBasePrismaClient());
}

export const prisma: PrismaClient = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
