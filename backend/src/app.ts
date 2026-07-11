import express from "express";
import cors from "cors";
import { recommendationsRouter } from "./routes/recommendations";
import { scheduleRouter } from "./routes/schedule";
import { rankingsRouter } from "./routes/rankings";
import { branchRouter } from "./branch/branchRoutes";
import { getCorsOrigin } from "./branch/branchSessionConfig";
import { prisma } from "./db/prisma";
import { getDbGateStats } from "./db/dbGate";
import { DB_LIMITS } from "./db/constants";
import { httpStatusForError, publicErrorMessage, HttpError } from "./utils/httpErrors";

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

const corsOrigin = getCorsOrigin();
if (corsOrigin) {
  app.use(cors({ origin: corsOrigin, credentials: true }));
} else {
  app.use(cors());
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "600kb" }));

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
app.use("/api/rankings", rankingsRouter);
app.use("/api/branches", branchRouter);

// ── Catch-all error handler ─────────────────────────────────────────────────

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = httpStatusForError(err);
    if (err instanceof HttpError) {
      if (status >= 500) console.error("[app] error:", err);
    } else if (status === 503) {
      console.warn("[app] service unavailable:", err instanceof Error ? err.message : err);
    } else if (status >= 500) {
      console.error("[app] unhandled error:", err);
    }
    if (!res.headersSent) {
      res.status(status).json({ error: publicErrorMessage(err, status) });
    }
  }
);

export { app };
