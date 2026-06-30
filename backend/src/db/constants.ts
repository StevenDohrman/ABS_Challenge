/**
 * Backend DB constants.
 *
 * All numeric thresholds and domain values used across the backend live here
 * so the intent behind each value is documented in one place.
 *
 * Sections:
 *   GAME_RULES      — MLB challenge-count rules (update if the rule changes)
 *   CALL_CODES      — MLB Stats API pitch call codes
 *   COUNT_STATES    — Every valid count state in a standard at-bat
 *   SEASONS         — Season-level defaults
 *   DB_LIMITS       — Database concurrency guardrails
 */

// ─────────────────────────────────────────────────────────────────────────────
// Game rules — MLB challenge-count rules
// ─────────────────────────────────────────────────────────────────────────────

export const GAME_RULES = {
  /**
   * Number of challenges each team starts with at the beginning of every game.
   * Under the current ABS challenge system, each team receives two challenges,
   * and a successful (overturned) challenge is retained — so only failed
   * challenges actually consume the allotment. See recomputeChallengesRemaining.
   * Update this constant if MLB changes the rule.
   */
  DEFAULT_CHALLENGES_PER_TEAM: 2,

  /**
   * Last inning of regulation play. Any inning beyond this is "extra innings"
   * and follows the per-inning challenge rule below.
   */
  LAST_REGULATION_INNING: 9,

  /**
   * Challenges granted per extra inning. In extra innings the regulation
   * allotment and any carryover are wiped: every team gets exactly this many
   * challenges, refreshed each extra inning (a successful challenge is still
   * retained within that inning). A team that reaches extras with two
   * challenges drops to one; a team that was out gets one back.
   */
  EXTRA_INNING_CHALLENGES_PER_INNING: 1,

  /**
   * Sentinel for "no challenges available". A team at zero cannot physically
   * challenge, but the engine still produces a value-based recommendation so the
   * system can surface missed opportunities — this is no longer a hard DENY gate.
   */
  ZERO_CHALLENGES_REMAINING: 0,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Call codes — MLB Stats API pitch call codes
// ─────────────────────────────────────────────────────────────────────────────

export const CALL_CODES = {
  /**
   * Called strike — the umpire or ABS system ruled the pitch a strike without
   * the batter swinging. This is the only call that triggers a batter challenge.
   */
  CALLED_STRIKE: "C",

  /** Ball — the pitch was ruled outside the strike zone. */
  BALL: "B",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Count states — every valid [balls, strikes] pair in a standard at-bat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All 12 valid count states, ordered naturally.
 * Used when pre-computing challenge recommendations for every count at the
 * start of each at-bat.
 *
 * Each tuple is [balls, strikes]. The maximum balls before a walk is 3,
 * and the maximum strikes before a strikeout is 2 (on the third strike).
 */
export const ALL_COUNT_STATES: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0, 1], [0, 2],
  [1, 0], [1, 1], [1, 2],
  [2, 0], [2, 1], [2, 2],
  [3, 0], [3, 1], [3, 2],
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Stat conversion — Savant percentage storage format
// ─────────────────────────────────────────────────────────────────────────────

export const STAT_CONVERSION = {
  /**
   * Savant stores plate discipline metrics as percentages (e.g. 22.5 for 22.5%).
   * The engine expects rates in the 0–1 range (e.g. 0.225).
   * Divide stored values by this constant before passing them to the engine.
   */
  PERCENT_TO_RATE_DIVISOR: 100,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Seasons
// ─────────────────────────────────────────────────────────────────────────────

export const SEASONS = {
  /** Current MLB season. Update at the start of each year. */
  CURRENT: 2026,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Postgame Savant enrichment
// ─────────────────────────────────────────────────────────────────────────────

export const SAVANT_POSTGAME = {
  /** Wait this long after Final before the first Savant fetch (Statcast lags ~12–24h). */
  INITIAL_DELAY_MS: 14 * 60 * 60_000,

  /** How often to poll Savant once the initial delay has elapsed (ms). */
  POLL_INTERVAL_MS: 10 * 60_000,

  /** Stop retrying if Statcast data never appears within this window after polling begins (ms). */
  MAX_DURATION_MS: 8 * 60 * 60_000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Data retention
// ─────────────────────────────────────────────────────────────────────────────

export const DATA_RETENTION = {
  /** Default days of game rows kept; override with DATA_RETENTION_DAYS env var. */
  DEFAULT_DAYS: 7,
} as const;

/** Game rows with gameDate before (today − N) are purged; N defaults to 7. */
export function getDataRetentionDays(): number {
  const parsed = parseInt(
    process.env["DATA_RETENTION_DAYS"] ?? String(DATA_RETENTION.DEFAULT_DAYS),
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DATA_RETENTION.DEFAULT_DAYS;
}

/** Earliest MLB gameDate still in DB for the configured retention window (inclusive). */
export function retentionWindowStart(today: string, retentionDays: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (retentionDays - 1));
  return d.toISOString().slice(0, 10);
}

/** Earliest time we should attempt the first Savant fetch for a Final game. */
export function savantPollEarliestAt(finalizedAt: Date): Date {
  return new Date(finalizedAt.getTime() + SAVANT_POSTGAME.INITIAL_DELAY_MS);
}

/** True when the initial post-Final delay has elapsed. */
export function isSavantPollingDue(
  finalizedAt: Date | null,
  nowMs: number = Date.now()
): boolean {
  if (!finalizedAt) return false;
  return nowMs >= savantPollEarliestAt(finalizedAt).getTime();
}

/** True when the active polling window has elapsed without success. */
export function isSavantEnrichmentExpired(
  startedAt: Date | null,
  nowMs: number = Date.now()
): boolean {
  if (!startedAt) return false;
  return nowMs - startedAt.getTime() >= SAVANT_POSTGAME.MAX_DURATION_MS;
}

/**
 * Absolute give-up time: initial delay + poll window from Final.
 * Used when polling never started (e.g. server was down through the poll window).
 */
export function isSavantEnrichmentAbandoned(
  finalizedAt: Date | null,
  enrichedAt: Date | null,
  startedAt: Date | null,
  nowMs: number = Date.now()
): boolean {
  if (enrichedAt) return false;
  if (startedAt && isSavantEnrichmentExpired(startedAt, nowMs)) return true;
  if (!finalizedAt) return false;
  const absoluteCapMs =
    SAVANT_POSTGAME.INITIAL_DELAY_MS + SAVANT_POSTGAME.MAX_DURATION_MS;
  return nowMs - finalizedAt.getTime() >= absoluteCapMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database concurrency guardrails
// ─────────────────────────────────────────────────────────────────────────────

export const DB_LIMITS = {
  /**
   * Maximum Prisma queries in flight process-wide. Every query acquires a slot
   * in dbGate before running (see db/prisma.ts). Keep this well below the
   * Prisma connection_limit (default num_cpus*2+1, often 17) so API reads and
   * live-poll writes can share the pool without P2024 timeouts.
   */
  MAX_CONCURRENT_QUERIES: 10,

  /** Log a warning when a query waits longer than this for a dbGate slot (ms). */
  GATE_WARN_WAIT_MS: 2_000,

  /**
   * Maximum number of write queries to keep in flight at once when persisting a
   * bulk batch — the daily Savant statline/spray/OAA upserts and the 12
   * per-at-bat recommendation rows pre-computed on every at-bat start.
   *
   * Must stay at or below MAX_CONCURRENT_QUERIES so a single batch cannot
   * monopolise every slot (reads and other handlers need headroom).
   */
  WRITE_CONCURRENCY: 4,
} as const;
