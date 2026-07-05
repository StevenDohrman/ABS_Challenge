/**
 * Challenge Service
 *
 * Coordinates the recommendation engine with the database.
 *
 * Primary responsibilities:
 *
 *   precomputeAtBatRecommendations — Called when a new at-bat starts.
 *     Computes a ChallengeDecision for all 12 count states using the current
 *     game context and the batter's pregame stats, then writes all 12 rows to
 *     the challenge_recommendations table. When a called-strike pitch arrives,
 *     the backend looks up the already-computed recommendation rather than
 *     running the engine in the hot path.
 *
 *   triggerRecommendation — Called when a called-strike pitch event arrives.
 *     Marks the matching pre-computed recommendation as active by setting
 *     triggeredAt = now(). The frontend API reads the most recent triggered row.
 *
 *   getLatestRecommendationForGame — Called by the API controller.
 *     Returns the most recently triggered recommendation for a game, along with
 *     the game context needed to build the frontend-facing DTO.
 */

import { decideChallenge } from "@abs/engine";
import type { MlbAtBatSnapshot, MlbLivePitchEvent } from "@abs/data-pipeline";
import { ALL_COUNT_STATES, CALL_CODES, DB_LIMITS } from "../db/constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { findGame, findLatestAtBatSnapshot } from "../db/gameRepository";
import {
  upsertRecommendation,
  markRecommendationTriggered,
  findLatestTriggeredRecommendation,
  findRecommendation,
  atBatHasCompletePrecompute,
  type ChallengeRecommendation,
} from "../db/recommendationRepository";
import type { LiveGameSnapshot } from "../db/gameRepository";
import {
  buildAtBatChallengeContext,
  buildChallengeInputForCount,
} from "./challengeInputBuilder";

export type { ChallengeRecommendation };

// ─────────────────────────────────────────────────────────────────────────────
// At-bat pre-computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-compute challenge recommendations for all 12 count states in this at-bat.
 *
 * Called when the LivePollJob emits an `atBatStart` event. By running the engine
 * now — before any pitches are thrown — the actual pitch-event handler can simply
 * look up the pre-computed result rather than computing on the fly.
 *
 * Pipeline DB work is serialised by enqueuePipelineDbWork in the orchestrator.
 */
export async function precomputeAtBatRecommendations(
  snapshot: MlbAtBatSnapshot
): Promise<void> {
  const game = await findGame(snapshot.gamePk);
  if (!game) {
    console.warn(
      `[challengeService] precompute skipped — game ${snapshot.gamePk} not in DB yet`
    );
    return;
  }

  if (await atBatHasCompletePrecompute(snapshot.gamePk, snapshot.atBatIndex)) {
    return;
  }

  const atBatContext = await buildAtBatChallengeContext(snapshot);

  const results = await mapSettledWithConcurrency(
    ALL_COUNT_STATES,
    DB_LIMITS.WRITE_CONCURRENCY,
    async ([balls, strikes]) => {
      const input = buildChallengeInputForCount(snapshot, balls, strikes, atBatContext);
      const decision = decideChallenge(input);

      await upsertRecommendation({
        gamePk: snapshot.gamePk,
        atBatIndex: snapshot.atBatIndex,
        balls,
        strikes,
        decision,
        challengeAvailable: atBatContext.challengeAvailable,
      });
    }
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `[challengeService] ${failures.length} of ${ALL_COUNT_STATES.length} ` +
        `recommendation upserts failed for game=${snapshot.gamePk} ` +
        `atBat=${snapshot.atBatIndex}`,
      failures.map((f) => (f as PromiseRejectedResult).reason)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pitch event handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle a pitch event from the live feed.
 *
 * If the call is a called strike, this activates the pre-computed recommendation
 * for this count state by setting its triggeredAt timestamp. The frontend
 * polls the API which reads the most recent triggered recommendation.
 *
 * Non-called-strike pitches (balls, swinging strikes, fouls, in-play) are
 * ignored here — they have no recommendation to display.
 *
 * @param event   The pitch event as emitted by LivePollJob.
 * @param dbRowId The DB id of the stored LivePitchEvent row (from gameRepository).
 */
export async function triggerRecommendationIfCalledStrike(
  event: MlbLivePitchEvent,
  dbRowId: number
): Promise<void> {
  if (event.callCode !== CALL_CODES.CALLED_STRIKE) return;

  const existing = await findRecommendation(
    event.gamePk,
    event.atBatIndex,
    event.ballsBefore,
    event.strikesBefore
  );

  if (!existing) {
    return;
  }

  if (existing.triggeredAt !== null) {
    return;
  }

  await markRecommendationTriggered(
    event.gamePk,
    event.atBatIndex,
    event.ballsBefore,
    event.strikesBefore,
    dbRowId
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The full package of data the API controller needs to build a response DTO.
 */
export interface LatestRecommendationContext {
  recommendation: ChallengeRecommendation;
  /** Game snapshot for the at-bat that triggered this recommendation. */
  snapshot: LiveGameSnapshot;
}

/**
 * Return the most recently triggered recommendation for a game along with
 * the matching at-bat snapshot. Returns null when no recommendation has been
 * triggered for this game yet.
 */
export async function getLatestRecommendationForGame(
  gamePk: number
): Promise<LatestRecommendationContext | null> {
  const recommendation = await findLatestTriggeredRecommendation(gamePk);
  if (!recommendation) return null;

  const snapshot = await findLatestAtBatSnapshot(gamePk);
  if (!snapshot) return null;

  return { recommendation, snapshot };
}
