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
 *   SavantDailyJob.batterStatlines → ingestService.handleBatterStatlines
 *
 * SavantDailyJob is run once at startup (to load pregame data) and re-run
 * daily at a scheduled time. In production, replace the 24-hour interval with
 * a cron job or a scheduled task runner.
 */

import { LivePollJob, SavantDailyJob } from "@abs/data-pipeline";
import {
  handleAtBatStart,
  handlePitchEvent,
  handleGameOver,
  handleBatterStatlines,
} from "./services/ingestService";
import {
  precomputeAtBatRecommendations,
  triggerRecommendationIfCalledStrike,
} from "./services/challengeService";
import { SEASONS } from "./db/constants";

/** How often to re-run the Savant daily job in milliseconds (24 hours). */
const SAVANT_DAILY_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/**
 * Start all pipeline jobs and register event handlers.
 * Called once at server startup.
 */
export async function startOrchestrator(): Promise<void> {
  startLivePollJob();
  await runSavantDailyJob(); // Run immediately at startup to load pregame data.
  scheduleSavantDailyJob();  // Then schedule daily reruns.
}

// ─────────────────────────────────────────────────────────────────────────────
// Live poll job
// ─────────────────────────────────────────────────────────────────────────────

function startLivePollJob(): void {
  const job = new LivePollJob();

  job.on("atBatStart", async (snapshot) => {
    // Write the snapshot first so precompute can read game context from the DB.
    await handleAtBatStart(snapshot);
    await precomputeAtBatRecommendations(snapshot);
  });

  job.on("pitchEvent", async (event) => {
    const dbRowId = await handlePitchEvent(event);
    if (dbRowId !== null) {
      await triggerRecommendationIfCalledStrike(event, dbRowId);
    }
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
