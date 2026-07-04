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
  buildDueUpWindow,
  toOuts,
  type GameStateContext,
  type PitchCallContext,
  type ChallengeDecisionInput,
  type BaserunningContextInput,
  type LineupContextInput,
  type DueUpBatter,
} from "@abs/engine";
import type { MlbAtBatSnapshot, MlbLivePitchEvent, DefensiveLineup } from "@abs/data-pipeline";
import { ALL_COUNT_STATES, SEASONS, CALL_CODES, DB_LIMITS } from "../db/constants";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import {
  findGame,
  findLatestAtBatSnapshot,
  computeTeamChallengesRemaining,
} from "../db/gameRepository";
import { findPlayerStatSnapshot, findPlayerStatSnapshotBatch } from "../db/playerRepository";
import { findSprayProfile, findFielderOaaBatch } from "../db/defensiveRepository";
import { findSprintSpeedBatch } from "../db/sprintSpeedRepository";
import { findBattingOrder } from "../db/lineupRepository";
import {
  upsertRecommendation,
  markRecommendationTriggered,
  findLatestTriggeredRecommendation,
  findRecommendation,
  atBatHasCompletePrecompute,
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

  // Load the batter's spray profile for the defensive context multiplier.
  // Null when the player hasn't hit enough (< 100 PA threshold on Savant) or
  // the daily ingest hasn't run yet — the engine defaults to 1.0× in that case.
  const sprayProfile = await findSprayProfile(snapshot.batterId, SEASONS.CURRENT);

  // Determine the relevant fielder OAA for this at-bat.
  // We identify which defensive position most likely covers this batter's primary
  // spray zone (based on spray profile + batting hand), then look up that
  // specific fielder's OAA from the live defensive lineup.
  // Falls back to null when the lineup is unavailable (historical backfill at-bats)
  // or when the fielder hasn't been ingested — the engine uses 0× adjustment.
  const battingHand = statSnapshot?.battingHand ?? null;
  const fielderOaa = await resolveFielderOaa(
    snapshot.defense,
    sprayProfile,
    battingHand
  );

  const playerContext = statSnapshot
    ? buildPlayerChallengeContext(statSnapshot, sprayProfile, fielderOaa)
    : buildDefaultPlayerChallengeContext(snapshot.batterId);

  const batterSprintSpeed = await resolveBaserunningContext(snapshot);

  const battingOrder =
    snapshot.battingOrder ??
    (await findBattingOrder(snapshot.gamePk, snapshot.battingTeamId));

  const lineupPlayerIds = buildDueUpWindow(
    battingOrder,
    snapshot.batterId,
    toOuts(snapshot.outs)
  );

  const lineupStatRows = await findPlayerStatSnapshotBatch(
    lineupPlayerIds,
    SEASONS.CURRENT
  );
  const lineupStatById = new Map(
    lineupStatRows.map((row) => [row.playerId, row])
  );

  const dueUpBatters: DueUpBatter[] = lineupPlayerIds.map((playerId) => {
    const row = lineupStatById.get(playerId);
    return {
      playerId,
      ops: finiteStat(row?.ops),
      woba: finiteStat(row?.woba),
    };
  });

  const lineupContext: LineupContextInput | undefined =
    dueUpBatters.length > 0 ? { dueUpBatters } : undefined;

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
        outs: toOuts(snapshot.outs),
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
        gameState.outs,
        gameState.balls,
        gameState.strikes,
        runners
      );

      const input: ChallengeDecisionInput = {
        gameState,
        playerContext,
        pitchContext,
        currentRunExpectancy: reValues.current,
        runExpectancyIfSuccessful: reValues.ifSucceeds,
        runExpectancyIfFailed: reValues.ifFails,
        baserunningContext: batterSprintSpeed,
        lineupContext,
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

  if (existing.triggeredAt !== null) {
    // Already triggered on a prior poll or before a pipeline restart — do not
    // clear and re-mark; pitch replay after restart is idempotent at the DB layer.
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

// ─────────────────────────────────────────────────────────────────────────────
// Baserunning / lineup resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

async function resolveBaserunningContext(
  snapshot: MlbAtBatSnapshot
): Promise<BaserunningContextInput> {
  const runnerIds = snapshot.runnerIds ?? {};
  const speedPlayerIds = [
    snapshot.batterId,
    runnerIds.first,
    runnerIds.second,
    runnerIds.third,
  ].filter((id): id is number => id !== undefined);

  const speedRows = await findSprintSpeedBatch(speedPlayerIds, SEASONS.CURRENT);
  const speedById = new Map(speedRows.map((row) => [row.playerId, row.sprintSpeed]));

  return {
    runnerIds,
    batterSprintSpeed: speedById.get(snapshot.batterId) ?? null,
    runnerSprintSpeeds: {
      first: runnerIds.first !== undefined ? speedById.get(runnerIds.first) ?? undefined : undefined,
      second: runnerIds.second !== undefined ? speedById.get(runnerIds.second) ?? undefined : undefined,
      third: runnerIds.third !== undefined ? speedById.get(runnerIds.third) ?? undefined : undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fielder OAA resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping from DefensiveLineup slot names (MLB live feed keys) to the OAA
 * position abbreviations used in the fielder_oaa table.
 */
const LINEUP_KEY_TO_OAA_POSITION: Record<string, string> = {
  first: "1B",
  second: "2B",
  third: "3B",
  shortstop: "SS",
  left: "LF",
  center: "CF",
  right: "RF",
};

/** Minimum spray weight (fraction of plays) a fielder must receive to be included. */
const MIN_ZONE_WEIGHT = 0.05;

/**
 * Compute spray-weighted zone coverage for each defensive position.
 *
 * Given the batter's pull/straight/oppo rates and GB/FB(+LD) rates, returns a
 * list of positional weights reflecting how often this batter's typical contact
 * falls into each fielder's coverage zone.
 *
 * Fly-ball / line-drive direction mapping (by batting hand):
 *   RHH pull  → RF   RHH straight → CF   RHH oppo → LF
 *   LHH pull  → LF   LHH straight → CF   LHH oppo → RF
 *
 * Ground-ball direction mapping (by batting hand):
 *   RHH pull → SS (55%) + 3B (35%)    RHH oppo → 2B (55%) + 1B (30%)
 *   LHH pull → 2B (55%) + 1B (35%)   LHH oppo → SS (55%) + 3B (30%)
 *   Straight ground balls split between SS/2B by hand (45% each)
 *
 * Returns only positions exceeding MIN_ZONE_WEIGHT after normalisation.
 * Returns an empty array when all spray inputs are null (no data available).
 */
interface PositionZoneWeight {
  defenseKey: string;
  oaaPosition: string;
  weight: number;
}

function computeZoneWeights(
  battingHand: string,
  pull: number,
  straight: number,
  oppo: number,
  gb: number,
  fb: number
): PositionZoneWeight[] {
  const raw: Record<string, number> = {};

  function add(key: string, w: number) {
    if (w > 0) raw[key] = (raw[key] ?? 0) + w;
  }

  if (battingHand === "R") {
    // Fly ball / line drive outfield coverage
    add("right",  fb * pull);
    add("center", fb * straight);
    add("left",   fb * oppo);
    // Ground ball infield coverage
    add("shortstop", gb * (pull * 0.55 + straight * 0.45));
    add("third",     gb * pull * 0.35);
    add("second",    gb * (oppo * 0.55 + straight * 0.45));
    add("first",     gb * oppo * 0.30);
  } else {
    // LHH: pull side is right field, oppo is left field
    add("left",   fb * pull);
    add("center", fb * straight);
    add("right",  fb * oppo);
    // Ground ball infield coverage
    add("second",    gb * (pull * 0.55 + straight * 0.45));
    add("first",     gb * pull * 0.35);
    add("shortstop", gb * (oppo * 0.55 + straight * 0.45));
    add("third",     gb * oppo * 0.30);
  }

  const total = Object.values(raw).reduce((s, w) => s + w, 0);
  if (total === 0) return [];

  return Object.entries(raw)
    .map(([key, w]) => ({
      defenseKey: key,
      oaaPosition: LINEUP_KEY_TO_OAA_POSITION[key],
      weight: w / total,
    }))
    .filter((z) => z.weight >= MIN_ZONE_WEIGHT && z.oaaPosition);
}

/**
 * Look up and combine OAA for the fielders covering this batter's spray zone.
 *
 * 1. Derive spray-weighted zone coverage from the batter's spray profile + hand.
 * 2. For each fielder in the zone, look up their player ID from the live lineup
 *    and their OAA from the fielder_oaa table (handedness-specific split when available).
 * 3. Return the spray-weighted average OAA across all fielders with data.
 *
 * Returns null when:
 *   - snapshot.defense is absent (historical backfill at-bats)
 *   - no spray data → falls back to the single center fielder as neutral proxy
 *   - no fielder OAA rows exist for any position in the zone
 */
async function resolveFielderOaa(
  defense: DefensiveLineup | undefined,
  sprayProfile: {
    pullPercent: number | null;
    straightawayPercent: number | null;
    oppoPercent: number | null;
    gbPercent: number | null;
    fbPercent: number | null;
    ldPercent: number | null;
  } | null,
  battingHand: string | null
): Promise<number | null> {
  if (!defense) return null;

  const hand = battingHand === "R" || battingHand === "L" ? battingHand : null;

  function oaaForRow(row: { oaa: number | null; oaaVsRhh: number | null; oaaVsLhh: number | null }): number | null {
    if (hand === "R" && row.oaaVsRhh !== null) return row.oaaVsRhh;
    if (hand === "L" && row.oaaVsLhh !== null) return row.oaaVsLhh;
    return row.oaa;
  }

  async function lookupSingle(fielderId: number | undefined, position: string): Promise<number | null> {
    if (!fielderId) return null;
    const rows = await findFielderOaaBatch([{ playerId: fielderId, position }], SEASONS.CURRENT);
    const row = rows[0];
    return row ? oaaForRow(row) : null;
  }

  // Without batting hand we cannot determine pull/oppo direction — fall back
  // to CF as a neutral single-fielder proxy (no zone weighting possible).
  if (!hand) {
    return lookupSingle(defense.center, "CF");
  }

  const pull     = sprayProfile?.pullPercent ?? null;
  const straight = sprayProfile?.straightawayPercent ?? null;
  const oppo     = sprayProfile?.oppoPercent ?? null;
  const gb       = sprayProfile?.gbPercent ?? null;
  const fb       = sprayProfile
    ? (sprayProfile.fbPercent ?? 0) + (sprayProfile.ldPercent ?? 0)
    : null;

  // If spray data is entirely missing, fall back to a single-fielder neutral lookup.
  if (pull === null && straight === null && oppo === null) {
    return lookupSingle(defense.center, "CF");
  }

  const zoneWeights = computeZoneWeights(
    hand,
    pull ?? 33,
    straight ?? 34,
    oppo ?? 33,
    gb ?? 44,
    fb ?? 56
  );

  if (zoneWeights.length === 0) return null;

  // Build lookup list and fetch all zone fielders in one query.
  const lookups: Array<{ playerId: number; position: string; weight: number; defenseKey: string }> = [];
  for (const zone of zoneWeights) {
    const fielderId = (defense as Record<string, number | undefined>)[zone.defenseKey];
    if (fielderId) {
      lookups.push({
        playerId: fielderId,
        position: zone.oaaPosition,
        weight: zone.weight,
        defenseKey: zone.defenseKey,
      });
    }
  }

  if (lookups.length === 0) return null;

  const rows = await findFielderOaaBatch(
    lookups.map(({ playerId, position }) => ({ playerId, position })),
    SEASONS.CURRENT
  );

  const rowByKey = new Map(
    rows.map((row) => [`${row.playerId}:${row.position}`, row])
  );

  let weightedSum = 0;
  let weightUsed = 0;

  for (const { playerId, position, weight } of lookups) {
    const row = rowByKey.get(`${playerId}:${position}`);
    if (!row) continue;

    const oaa = oaaForRow(row);
    if (oaa === null || !Number.isFinite(oaa)) continue;

    weightedSum += oaa * weight;
    weightUsed += weight;
  }

  if (weightUsed === 0) return null;

  const average = weightedSum / weightUsed;
  return Number.isFinite(average) ? average : null;
}

function finiteStat(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}
