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

import type { MlbAtBatSnapshot, MlbLivePitchEvent, SavantBatterStatline, SavantBatterSprayProfile, SavantFielderOaa, ActiveGame } from "@abs/data-pipeline";
import { upsertGame, markGameFinal, upsertAtBatSnapshot, upsertPitchEvent, findGame, recomputeChallengesRemaining, reconcileAllChallengeCounts } from "../db/gameRepository";
import { upsertBatterStatlines } from "../db/playerRepository";
import { upsertSprayProfiles, upsertFielderOaa } from "../db/defensiveRepository";

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
 * Recompute every tracked game's challenge counts from their stored review
 * events. Run once at startup to repair counts that earlier decrement-on-restart
 * behavior left corrupted (often floored at zero, which forced every
 * recommendation into a hard DENY with zero expected value). Idempotent — the
 * counts are derived from the source of truth, so re-running is always safe.
 */
export async function reconcileChallengeCounts(): Promise<void> {
  try {
    const reconciled = await reconcileAllChallengeCounts();
    console.log(`[ingestService] reconciled challenge counts for ${reconciled} games`);
  } catch (err) {
    console.error("[ingestService] failed to reconcile challenge counts:", err);
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
    // Safety net: ensure the game row exists before writing the snapshot.
    // Under normal operation gameDiscovered fires first, but on pipeline
    // restarts or race conditions the game row may be missing.
    const existing = await findGame(snapshot.gamePk);
    if (!existing) {
      console.warn(
        `[ingestService] game ${snapshot.gamePk} missing at atBatStart — creating from snapshot`
      );
      const homeTeamId = snapshot.halfInning === "top"
        ? snapshot.fieldingTeamId
        : snapshot.battingTeamId;
      const awayTeamId = snapshot.halfInning === "top"
        ? snapshot.battingTeamId
        : snapshot.fieldingTeamId;
      await upsertGame({
        gamePk: snapshot.gamePk,
        officialDate: new Date().toISOString().slice(0, 10),
        scheduledStartTime: new Date().toISOString(),
        status: "Live",
        detailedState: "In Progress",
        homeTeamId,
        homeTeamName: String(homeTeamId),
        awayTeamId,
        awayTeamName: String(awayTeamId),
      });
    }
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
 *
 * Side effect: when the event has `hasReview=true` and a `challengerTeamId`,
 * recomputes that game's challenge counts from all stored review events.
 */
export async function handlePitchEvent(
  event: MlbLivePitchEvent
): Promise<number | null> {
  try {
    const row = await upsertPitchEvent(event);

    // A review event means a challenge was used. Recompute (rather than
    // decrement) so reprocessing the same pitch — which happens on every
    // process restart, since the poller re-emits the full feed — never
    // double-counts. The just-upserted row is included in the derivation.
    if (event.hasReview && event.challengerTeamId) {
      await recomputeChallengesRemaining(event.gamePk);
    }

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
 */
export async function handleBatterStatlines(
  statlines: SavantBatterStatline[]
): Promise<void> {
  try {
    console.log(`[ingestService] upserting ${statlines.length} batter statlines`);
    await upsertBatterStatlines(statlines);
  } catch (err) {
    console.error("[ingestService] failed to upsert batter statlines batch:", err);
  }
}

/**
 * Persist a batch of batter spray profiles from the SavantDailyJob.
 */
export async function handleSprayProfiles(
  profiles: SavantBatterSprayProfile[]
): Promise<void> {
  try {
    console.log(`[ingestService] upserting ${profiles.length} spray profiles`);
    await upsertSprayProfiles(profiles);
  } catch (err) {
    console.error("[ingestService] failed to upsert spray profiles batch:", err);
  }
}

/**
 * Persist a batch of fielder OAA rows from the SavantDailyJob.
 */
export async function handleFielderOaa(
  oaaRows: SavantFielderOaa[]
): Promise<void> {
  try {
    console.log(`[ingestService] upserting ${oaaRows.length} fielder OAA rows`);
    await upsertFielderOaa(oaaRows);
  } catch (err) {
    console.error("[ingestService] failed to upsert fielder OAA batch:", err);
  }
}
