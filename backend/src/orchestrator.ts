/**
 * Orchestrator
 *
 * Wires the data pipeline jobs to the backend services.
 *
 * The orchestrator is the only place in the backend that knows about both
 * the data pipeline and the backend services. Everything else flows through
 * typed function calls — no global state, no EventEmitter coupling beyond
 * this file.
 *
 * Pipeline → DB write flow:
 *   LivePollJob.atBatStart  → ingestService.handleAtBatStart
 *                           → challengeService.precomputeAtBatRecommendations
 *
 *   LivePollJob.pitchEvent  → ingestService.handlePitchEvent
 *                           → challengeService.triggerRecommendationIfCalledStrike
 *
 *   LivePollJob.gameOver    → ingestService.handleGameOver
 *
 *   SavantDailyJob.batterStatlines       → ingestService.handleBatterStatlines
 *   SavantDailyJob.sprayProfiles         → ingestService.handleSprayProfiles
 *   SavantDailyJob.fielderOaa            → ingestService.handleFielderOaa
 *
 * SavantDailyJob is run once at startup (to load pregame data) and re-run
 * daily at a scheduled time. In production, replace the 24-hour interval with
 * a cron job or a scheduled task runner.
 */

import { LivePollJob, SavantDailyJob } from "@abs/data-pipeline";
import {
  handleGameDiscovered,
  handleAtBatStart,
  handlePitchEvent,
  handleGameOver,
  handleBatterStatlines,
  handleSprayProfiles,
  handleFielderOaa,
  reconcileChallengeCounts,
} from "./services/ingestService";
import {
  precomputeAtBatRecommendations,
  triggerRecommendationIfCalledStrike,
} from "./services/challengeService";
import { processGameBackfill } from "./services/gameBackfillService";
import { purgeOldGames } from "./db/cleanupRepository";
import {
  enqueuePipelineDbWork,
  trackGameBackfill,
  trackGameBackfillPitchReady,
  waitForGameBackfillPitchReady,
} from "./db/pipelineDbQueue";
import { SEASONS } from "./db/constants";

/** How often to re-run the Savant daily job in milliseconds (24 hours). */
const SAVANT_DAILY_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** Retain this many days of game data. Override with DATA_RETENTION_DAYS env var. */
const DATA_RETENTION_DAYS = parseInt(process.env["DATA_RETENTION_DAYS"] ?? "7", 10);

/**
 * Start all pipeline jobs and register event handlers.
 * Called once at server startup.
 */
export async function startOrchestrator(): Promise<void> {
  // Load pregame Savant data FIRST, before live polling starts. Two reasons:
  //   1. The Savant batch is a large bulk upsert; running it before the live
  //      poll begins means the two never contend for the connection pool at
  //      startup (the original cause of the P2024 pool-timeout errors).
  //   2. Player stats are then already in the DB when the first at-bat is
  //      precomputed, so recommendations use real stats instead of defaults.
  // The daily rerun is concurrency-capped (DB_LIMITS.WRITE_CONCURRENCY), so it
  // is safe to run alongside live polling later in the process lifetime.
  await runSavantDailyJob();
  // Repair any challenge counts left corrupted by earlier restarts BEFORE live
  // polling begins, so the first poll's backfill re-precomputes historical
  // at-bats using the corrected counts (a 0 count forces every grid to DENY).
  await reconcileChallengeCounts();
  startLivePollJob();
  scheduleSavantDailyJob();  // Then schedule daily reruns.
  await runCleanupJob();     // Purge old data at startup and schedule daily reruns.
  scheduleCleanupJob();
}

// ─────────────────────────────────────────────────────────────────────────────
// Live poll job
// ─────────────────────────────────────────────────────────────────────────────

function startLivePollJob(): void {
  const job = new LivePollJob();

  job.on("gameDiscovered", async (game) => {
    await handleGameDiscovered(game);
  });

  /**
   * Mid-game first poll: batch of completed at-bats. Runs on the low-priority
   * queue as a single job. Pitch replay waits only until called-strike at-bats
   * are pre-computed; the rest of the history fills in in the background.
   */
  job.on("gameBackfill", (payload) => {
    if (payload.snapshots.length === 0) return;
    const gamePk = payload.snapshots[0].gamePk;

    let resolvePitchReady!: () => void;
    const pitchReady = new Promise<void>((resolve) => {
      resolvePitchReady = resolve;
    });
    trackGameBackfillPitchReady(gamePk, pitchReady);

    const work = enqueuePipelineDbWork(
      `backfill-batch game=${gamePk} count=${payload.snapshots.length} cs=${payload.calledStrikeAtBatIndices.length}`,
      () => processGameBackfill(payload, resolvePitchReady),
      "low"
    );
    trackGameBackfill(gamePk, work);
  });

  job.on("atBatStart", async (snapshot) => {
    // Current at-bat is not blocked by historical backfill — process immediately.
    await enqueuePipelineDbWork(
      `atBatStart game=${snapshot.gamePk} atBat=${snapshot.atBatIndex}`,
      async () => {
        await handleAtBatStart(snapshot);
        await precomputeAtBatRecommendations(snapshot);
      },
      "high"
    );
  });

  job.on("pitchEvent", async (event) => {
    await waitForGameBackfillPitchReady(event.gamePk);
    await enqueuePipelineDbWork(
      `pitch game=${event.gamePk} atBat=${event.atBatIndex} pitch=${event.pitchNumber}`,
      async () => {
        const dbRowId = await handlePitchEvent(event);
        if (dbRowId !== null) {
          await triggerRecommendationIfCalledStrike(event, dbRowId);
        }
      },
      "high"
    );
  });

  job.on("gameOver", async ({ gamePk }) => {
    await handleGameOver(gamePk);
  });

  job.on("error", (err) => {
    console.error("[orchestrator] LivePollJob error:", err);
  });

  job.start();
  console.log("[orchestrator] LivePollJob started");
}

// ─────────────────────────────────────────────────────────────────────────────
// Savant daily job
// ─────────────────────────────────────────────────────────────────────────────

async function runSavantDailyJob(): Promise<void> {
  const job = new SavantDailyJob();

  job.on("batterStatlines", async (statlines) => {
    await handleBatterStatlines(statlines);
  });

  job.on("sprayProfiles", async (profiles) => {
    await handleSprayProfiles(profiles);
  });

  job.on("fielderOaa", async (oaaRows) => {
    await handleFielderOaa(oaaRows);
  });

  job.on("error", (err) => {
    console.error("[orchestrator] SavantDailyJob error:", err);
  });

  console.log(`[orchestrator] running SavantDailyJob for season ${SEASONS.CURRENT}`);
  await job.run(SEASONS.CURRENT);
  console.log("[orchestrator] SavantDailyJob complete");
}

function scheduleSavantDailyJob(): void {
  setInterval(() => {
    runSavantDailyJob().catch((err) => {
      console.error("[orchestrator] SavantDailyJob scheduled run error:", err);
    });
  }, SAVANT_DAILY_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Data retention cleanup
// ─────────────────────────────────────────────────────────────────────────────

async function runCleanupJob(): Promise<void> {
  try {
    console.log(`[orchestrator] purging game data older than ${DATA_RETENTION_DAYS} days`);
    const result = await purgeOldGames(DATA_RETENTION_DAYS);
    if (result.games > 0) {
      console.log(
        `[orchestrator] cleanup removed ${result.games} games, ` +
        `${result.snapshots} snapshots, ${result.pitchEvents} pitch events, ` +
        `${result.recommendations} recommendations`
      );
    } else {
      console.log("[orchestrator] cleanup: nothing to purge");
    }
  } catch (err) {
    // Never let cleanup crash the server.
    console.error("[orchestrator] cleanup error:", err);
  }
}

function scheduleCleanupJob(): void {
  setInterval(() => {
    void runCleanupJob();
  }, SAVANT_DAILY_INTERVAL_MS); // Run once per day alongside the Savant job.
}
