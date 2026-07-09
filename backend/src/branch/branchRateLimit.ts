import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";
import { parseBranchSessionCookie } from "./branchSessionStore";

interface RateLimitOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Max requests per window per client key. */
  max: number;
  /** Human-readable label for error messages. */
  label: string;
}

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const session = parseBranchSessionCookie(req.headers.cookie);
  return session ? `${ip}:${session}` : ip;
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

/** In-memory per-IP (and session when present) rate limiter for branch endpoints. */
export function branchRateLimit(options: RateLimitOptions) {
  const { windowMs, max, label } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (buckets.size > 10_000) pruneExpired(now);

    const key = `${label}:${clientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpError(429, `Too many ${label} requests; try again later`);
    }

    next();
  };
}

/** Test-only reset. */
export function resetBranchRateLimitsForTests(): void {
  buckets.clear();
}
