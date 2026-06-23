import express from "express";
import cors from "cors";
import { recommendationsRouter } from "./routes/recommendations";

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Lightweight liveness check for load balancers and monitoring.
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * /api/games  → recommendation + confidence endpoints
 *
 * Example endpoints:
 *   GET  /api/games/:gamePk/recommendation
 *   POST /api/games/:gamePk/confidence
 */
app.use("/api/games", recommendationsRouter);

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
