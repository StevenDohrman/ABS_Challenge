/**
 * Ingest Service
 *
 * Writes data from the pipeline jobs to the database.
 *
 * This service owns all DB writes that originate from the data pipeline:
 *   - LivePollJob events  → live_game_snapshots, live_pitch_events, games
 *   - SavantDailyJob events → player_stat_snapshots
 *
 * It does not call the challenge engine. That coordination happens in
 * challengeService, which the orchestrator calls separately.
 */

import type { MlbAtBatSnapshot, MlbLivePitchEvent, SavantBatterStatline, ActiveGame } from "@abs/data-pipeline";
import { upsertGame, markGameFinal, upsertAtBatSnapshot, upsertPitchEvent } from "../db/gameRepository";
import { upsertBatterStatlines } from "../db/playerRepository";

// ─────────────────────────────────────────────────────────────────────────────
// Game lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure a game row exists in the DB when the LivePollJob discovers it.
 * Safe to call multiple times — upsertGame is idempotent.
 */
export async function handleGameDiscovered(game: ActiveGame): Promise<void> {
  try {
    await upsertGame(game);
  } catch (err) {
    console.error(
      `[ingestService] failed to upsert game ${game.gamePk}:`,
      err
    );
  }
}

/**
 * Update the game status to Final when the poller emits a gameOver event.
 */
export async function handleGameOver(gamePk: number): Promise<void> {
  try {
    await markGameFinal(gamePk);
    console.log(`[ingestService] game ${gamePk} marked Final`);
  } catch (err) {
    console.error(
      `[ingestService] failed to mark game ${gamePk} Final:`,
      err
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live poll events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist the game state at the start of a new at-bat.
 * Returns the saved DB row so the orchestrator can pass it to the challenge service.
 */
export async function handleAtBatStart(
  snapshot: MlbAtBatSnapshot
): Promise<void> {
  try {
    await upsertAtBatSnapshot(snapshot);
  } catch (err) {
    console.error(
      `[ingestService] failed to upsert at-bat snapshot ` +
      `game=${snapshot.gamePk} atBat=${snapshot.atBatIndex}:`,
      err
    );
  }
}

/**
 * Persist a pitch event from the live feed.
 * Returns the stored DB row ID so the orchestrator can link it to a recommendation.
 *
 * Returns null on failure — the orchestrator skips recommendation triggering
 * when no DB row was created.
 */
export async function handlePitchEvent(
  event: MlbLivePitchEvent
): Promise<number | null> {
  try {
    const row = await upsertPitchEvent(event);
    return row.id;
  } catch (err) {
    console.error(
      `[ingestService] failed to upsert pitch event ` +
      `game=${event.gamePk} at-bat=${event.atBatIndex} pitch=${event.pitchNumber}:`,
      err
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Savant daily events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a batch of batter statlines from the SavantDailyJob.
 * Individual row failures are handled inside upsertBatterStatlines.
 * A batch-level failure (e.g. DB unreachable) is caught here so it cannot
 * crash the orchestrator loop.
 */
export async function handleBatterStatlines(
  statlines: SavantBatterStatline[]
): Promise<void> {
  try {
    console.log(
      `[ingestService] upserting ${statlines.length} batter statlines`
    );
    await upsertBatterStatlines(statlines);
  } catch (err) {
    console.error("[ingestService] failed to upsert batter statlines batch:", err);
  }
}
