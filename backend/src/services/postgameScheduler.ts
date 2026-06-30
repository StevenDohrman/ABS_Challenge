/**
 * Schedules postgame Savant enrichment with a 14-hour initial delay and polling window.
 * Shared by the live gameOver path and final-game backfill.
 */

import { SavantPostgameJob } from "@abs/data-pipeline";
import {
  SAVANT_POSTGAME,
  isSavantEnrichmentAbandoned,
  isSavantPollingDue,
  savantPollEarliestAt,
} from "../db/constants";
import {
  findGame,
  isSavantEnriched,
  markSavantEnrichmentStarted,
} from "../db/gameRepository";
import {
  handleSavantPostgameNotReady,
  handleSavantPostgamePitches,
} from "./ingestService";
import { enqueuePipelineDbWork } from "../db/pipelineDbQueue";

const pendingSavantDelayTimers = new Map<number, ReturnType<typeof setTimeout>>();
const pendingSavantPollIntervals = new Map<number, ReturnType<typeof setInterval>>();

export function scheduleSavantPostgameEnrichment(gamePk: number): void {
  void (async () => {
    clearSavantPostgameRetries(gamePk);

    const game = await findGame(gamePk);
    if (!game || game.savantEnrichedAt) return;
    if (
      isSavantEnrichmentAbandoned(
        game.finalizedAt,
        game.savantEnrichedAt,
        game.savantEnrichmentStartedAt
      )
    ) {
      console.log(
        `[postgameScheduler] Savant enrichment window expired for game ${gamePk} — not scheduling`
      );
      return;
    }

    if (!game.finalizedAt) {
      console.warn(
        `[postgameScheduler] game ${gamePk} is Final but finalizedAt is missing — skipping Savant schedule`
      );
      return;
    }

    const earliest = savantPollEarliestAt(game.finalizedAt);
    const delayMs = Math.max(0, earliest.getTime() - Date.now());

    if (delayMs > 0) {
      console.log(
        `[postgameScheduler] Savant postgame for game ${gamePk} scheduled in ${Math.round(delayMs / 60_000)} min ` +
          `(earliest ${earliest.toISOString()})`
      );
      const delayTimer = setTimeout(() => {
        pendingSavantDelayTimers.delete(gamePk);
        beginSavantPolling(gamePk);
      }, delayMs);
      pendingSavantDelayTimers.set(gamePk, delayTimer);
      return;
    }

    beginSavantPolling(gamePk);
  })();
}

function beginSavantPolling(gamePk: number): void {
  void (async () => {
    const game = await findGame(gamePk);
    if (!game || game.savantEnrichedAt) return;
    if (!isSavantPollingDue(game.finalizedAt)) return;
    if (
      isSavantEnrichmentAbandoned(
        game.finalizedAt,
        game.savantEnrichedAt,
        game.savantEnrichmentStartedAt
      )
    ) {
      return;
    }

    await markSavantEnrichmentStarted(gamePk);

    if (pendingSavantPollIntervals.has(gamePk)) return;

    void runSavantPostgameJob(gamePk);

    const interval = setInterval(() => {
      void runSavantPostgameJob(gamePk);
    }, SAVANT_POSTGAME.POLL_INTERVAL_MS);

    pendingSavantPollIntervals.set(gamePk, interval);
  })();
}

export async function resumePendingSavantEnrichments(): Promise<void> {
  const { prisma } = await import("../db/prisma");
  const pending = await prisma.game.findMany({
    where: {
      status: "Final",
      savantEnrichedAt: null,
      finalizedAt: { not: null },
    },
    select: {
      gamePk: true,
      finalizedAt: true,
      savantEnrichmentStartedAt: true,
      savantEnrichedAt: true,
    },
  });

  for (const game of pending) {
    if (
      isSavantEnrichmentAbandoned(
        game.finalizedAt,
        game.savantEnrichedAt,
        game.savantEnrichmentStartedAt
      )
    ) {
      continue;
    }
    console.log(
      `[postgameScheduler] resuming Savant postgame enrichment for game ${game.gamePk}`
    );
    scheduleSavantPostgameEnrichment(game.gamePk);
  }
}

async function runSavantPostgameJob(gamePk: number): Promise<void> {
  if (await isSavantEnriched(gamePk)) {
    clearSavantPostgameRetries(gamePk);
    return;
  }

  const game = await findGame(gamePk);
  if (!game) return;
  if (!isSavantPollingDue(game.finalizedAt)) return;
  if (
    isSavantEnrichmentAbandoned(
      game.finalizedAt,
      game.savantEnrichedAt,
      game.savantEnrichmentStartedAt
    )
  ) {
    console.log(
      `[postgameScheduler] giving up Savant enrichment for game ${gamePk} after ` +
        `${(SAVANT_POSTGAME.INITIAL_DELAY_MS + SAVANT_POSTGAME.MAX_DURATION_MS) / 3_600_000}h from Final`
    );
    clearSavantPostgameRetries(gamePk);
    return;
  }

  const job = new SavantPostgameJob();

  job.on("postgamePitches", async ({ gamePk: pk, pitches }) => {
    await enqueuePipelineDbWork(
      `savant-postgame game=${pk} pitches=${pitches.length}`,
      () => handleSavantPostgamePitches(pk, pitches),
      "low"
    );
    clearSavantPostgameRetries(pk);
  });

  job.on("notReady", async ({ gamePk: pk }) => {
    await handleSavantPostgameNotReady(pk);
    console.log(`[postgameScheduler] Savant data not ready for game ${pk} — will retry`);
  });

  job.on("error", (err) => {
    console.error(`[postgameScheduler] SavantPostgameJob error game=${gamePk}:`, err);
  });

  console.log(`[postgameScheduler] running SavantPostgameJob for game ${gamePk}`);
  await job.run(gamePk);
}

function clearSavantPostgameRetries(gamePk: number): void {
  const delayTimer = pendingSavantDelayTimers.get(gamePk);
  if (delayTimer) {
    clearTimeout(delayTimer);
    pendingSavantDelayTimers.delete(gamePk);
  }
  const interval = pendingSavantPollIntervals.get(gamePk);
  if (interval) {
    clearInterval(interval);
    pendingSavantPollIntervals.delete(gamePk);
  }
}
