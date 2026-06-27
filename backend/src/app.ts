import express from "express";
import cors from "cors";
import { recommendationsRouter } from "./routes/recommendations";
import { scheduleRouter } from "./routes/schedule";
import { prisma } from "./db/prisma";
import { getDbGateStats } from "./db/dbGate";
import { DB_LIMITS } from "./db/constants";

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Lightweight liveness check for load balancers and monitoring.
 */
app.get("/health", async (_req, res) => {
  let db: "connected" | "disconnected" = "disconnected";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "connected";
  } catch {
    // DB unreachable — server is still up, just report the state.
  }
  const pool = getDbGateStats();
  res.json({
    status: "ok",
    db,
    pool: {
      ...pool,
      maxConcurrent: DB_LIMITS.MAX_CONCURRENT_QUERIES,
    },
  });
});

/**
 * /api/games  → recommendation + confidence endpoints
 *
 * Example endpoints:
 *   GET  /api/games/:gamePk/recommendation
 *   POST /api/games/:gamePk/confidence
 */
app.use("/api/games", recommendationsRouter);
app.use("/api/schedule", scheduleRouter);

// ── Catch-all error handler ─────────────────────────────────────────────────

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[app] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export { app };
