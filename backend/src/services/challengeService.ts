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

import {
  decideChallenge,
  computeChallengeOutcomeExpectancies,
  type GameStateContext,
  type PitchCallContext,
  type ChallengeDecisionInput,
} from "@abs/engine";
import type { MlbAtBatSnapshot, MlbLivePitchEvent } from "@abs/data-pipeline";
import { ALL_COUNT_STATES, SEASONS, CALL_CODES, DB_LIMITS } from "../db/constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import {
  findGame,
  findLatestAtBatSnapshot,
  computeTeamChallengesRemaining,
} from "../db/gameRepository";
import { findPlayerStatSnapshot } from "../db/playerRepository";
import {
  upsertRecommendation,
  markRecommendationTriggered,
  findLatestTriggeredRecommendation,
  findRecommendation,
  type ChallengeRecommendation,
} from "../db/recommendationRepository";
import {
  buildPlayerChallengeContext,
  buildDefaultPlayerChallengeContext,
} from "./playerContextBuilder";
import type { LiveGameSnapshot } from "../db/gameRepository";

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
 * Steps:
 *   1. Look up challenges remaining for the batting team from the games table.
 *   2. Look up the batter's pregame stats from the player_stat_snapshots table.
 *   3. For each of the 12 count states, compute RE values and run the engine.
 *   4. Write all 12 rows to challenge_recommendations.
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

  // Determine how many challenges the batting team has available for this at-bat.
  // Derived per inning so the extra-innings rule (flat 1 per extra inning, with
  // regulation carryover wiped) is applied correctly. This is the same for all
  // 12 count states in the at-bat.
  const challengesRemaining = await computeTeamChallengesRemaining(
    snapshot.gamePk,
    snapshot.battingTeamId,
    snapshot.inning
  );

  // Whether the team can physically challenge. The engine recommendation is
  // value-based regardless; this flag lets the UI flag missed opportunities
  // (a high-value call the team is out of challenges for).
  const challengeAvailable = challengesRemaining > 0;

  // Run differential from the batting team's perspective.
  const runDifferential =
    snapshot.halfInning === "top"
      ? snapshot.awayScore - snapshot.homeScore
      : snapshot.homeScore - snapshot.awayScore;

  // Load the batter's pregame stats. Fall back to defaults if not ingested yet.
  const statSnapshot = await findPlayerStatSnapshot(
    snapshot.batterId,
    SEASONS.CURRENT
  );
  const playerContext = statSnapshot
    ? buildPlayerChallengeContext(statSnapshot)
    : buildDefaultPlayerChallengeContext(snapshot.batterId);

  const runners = {
    first: snapshot.runnerOnFirst,
    second: snapshot.runnerOnSecond,
    third: snapshot.runnerOnThird,
  };

  // We don't know the pitcher's handedness from the at-bat snapshot alone.
  // pitcherHandedness is null; the engine treats this as no handedness adjustment.
  const pitchContext: PitchCallContext = {
    callType: "called_strike",
    pitcherHandedness: null,
  };

  // Compute and store a recommendation for every valid count state.
  // Each count's decision is computed in memory (pure engine call) and then
  // persisted; only the DB writes are concurrency-capped so a busy startup —
  // many games backfilling at once — cannot exhaust the connection pool.
  const results = await mapSettledWithConcurrency(
    ALL_COUNT_STATES,
    DB_LIMITS.WRITE_CONCURRENCY,
    async ([balls, strikes]) => {
      const gameState: GameStateContext = {
        gamePk: snapshot.gamePk,
        inning: snapshot.inning,
        halfInning: snapshot.halfInning,
        balls,
        strikes,
        outs: snapshot.outs,
        runnerOnFirst: snapshot.runnerOnFirst,
        runnerOnSecond: snapshot.runnerOnSecond,
        runnerOnThird: snapshot.runnerOnThird,
        homeScore: snapshot.homeScore,
        awayScore: snapshot.awayScore,
        runDifferentialForBattingTeam: runDifferential,
        battingTeamId: snapshot.battingTeamId,
        fieldingTeamId: snapshot.fieldingTeamId,
        batterId: snapshot.batterId,
        pitcherId: snapshot.pitcherId,
        challengesRemaining,
      };

      const reValues = computeChallengeOutcomeExpectancies(
        snapshot.outs,
        balls,
        strikes,
        runners
      );

      const input: ChallengeDecisionInput = {
        gameState,
        playerContext,
        pitchContext,
        currentRunExpectancy: reValues.current,
        runExpectancyIfSuccessful: reValues.ifSucceeds,
        runExpectancyIfFailed: reValues.ifFails,
      };

      const decision = decideChallenge(input);

      await upsertRecommendation({
        gamePk: snapshot.gamePk,
        atBatIndex: snapshot.atBatIndex,
        balls,
        strikes,
        decision,
        challengeAvailable,
      });
    }
  );

  // Surface dropped writes: a failed upsert means a count state has no stored
  // recommendation, so the frontend would show no card for that count. Logged
  // (not thrown) so one bad write never crashes the pipeline.
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
    // Pre-computation races or pipeline startup before this at-bat: skip silently.
    // The frontend simply shows no recommendation card for this pitch.
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
