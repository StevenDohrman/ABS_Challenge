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

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
