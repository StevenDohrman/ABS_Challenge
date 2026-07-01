import { prisma } from "./prisma";
import { GAME_RULES } from "./constants";
import type { MlbAtBatSnapshot, MlbLivePitchEvent, ActiveGame } from "@abs/data-pipeline";
import type { Game, LiveGameSnapshot, LivePitchEvent } from "@prisma/client";

export type { Game, LiveGameSnapshot, LivePitchEvent };

// ─────────────────────────────────────────────────────────────────────────────
// games
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert or update a game row from a discovered ActiveGame.
 * Does not overwrite challenge counts — those are managed separately.
 */
export async function upsertGame(game: ActiveGame): Promise<Game> {
  return prisma.game.upsert({
    where: { gamePk: game.gamePk },
    update: {
      status: game.status,
      updatedAt: new Date(),
    },
    create: {
      gamePk: game.gamePk,
      gameDate: game.officialDate,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      status: game.status,
      homeChallengesRemaining: GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM,
      awayChallengesRemaining: GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM,
    },
  });
}

/**
 * Mark a game as Final.
 */
export async function markGameFinal(gamePk: number): Promise<void> {
  await ensureGameFinalized(gamePk, new Date());
}

/**
 * Mark a game Final and record when it ended. finalizedAt is only set once so
 * Savant scheduling and backfill do not reset the 14-hour window.
 */
export async function ensureGameFinalized(
  gamePk: number,
  finalizedAt: Date
): Promise<void> {
  await prisma.game.updateMany({
    where: { gamePk },
    data: { status: "Final", updatedAt: new Date() },
  });
  await prisma.game.updateMany({
    where: { gamePk, finalizedAt: null },
    data: { finalizedAt, updatedAt: new Date() },
  });
}

export async function countGameAtBats(gamePk: number): Promise<number> {
  return prisma.liveGameSnapshot.count({ where: { gamePk } });
}

export async function countGamePitches(gamePk: number): Promise<number> {
  return prisma.livePitchEvent.count({ where: { gamePk } });
}

export async function markSavantEnriched(gamePk: number): Promise<void> {
  await prisma.game.updateMany({
    where: { gamePk },
    data: { savantEnrichedAt: new Date(), updatedAt: new Date() },
  });
}

/** Record when postgame Savant polling began (idempotent — only sets once). */
export async function markSavantEnrichmentStarted(gamePk: number): Promise<void> {
  await prisma.game.updateMany({
    where: { gamePk, savantEnrichmentStartedAt: null },
    data: { savantEnrichmentStartedAt: new Date(), updatedAt: new Date() },
  });
}

export async function incrementSavantEnrichmentAttempt(gamePk: number): Promise<void> {
  await prisma.game.update({
    where: { gamePk },
    data: { savantEnrichmentAttempts: { increment: 1 } },
  });
}

export async function isSavantEnriched(gamePk: number): Promise<boolean> {
  const game = await prisma.game.findUnique({
    where: { gamePk },
    select: { savantEnrichedAt: true },
  });
  return game?.savantEnrichedAt != null;
}

/**
 * Returns the game row for the given gamePk, or null if not found.
 */
export async function findGame(gamePk: number): Promise<Game | null> {
  return prisma.game.findUnique({ where: { gamePk } });
}

/**
 * Derive how many challenges a team has available at a given inning, from the
 * stored review pitch events — the source of truth — rather than a mutable
 * counter.
 *
 * Why derive instead of decrement: the live poller re-emits every pitch from the
 * full feed on each process start (its dedup cache is in-memory only), so a
 * decrement-on-review side effect double-counts on every restart and eventually
 * floors the count at zero. Deriving the count is idempotent and self-healing —
 * it produces the same correct value no matter how many times a review event is
 * reprocessed.
 *
 * Only FAILED challenges consume the allotment: under ABS rules a team retains a
 * challenge it wins (the call is overturned). A challenge counts as used only
 * when `hasReview = true` and `isOverturned = false` (a resolved, unsuccessful
 * challenge). Reviews still in progress (`isOverturned = null`) are not counted
 * until they resolve.
 *
 * Regulation (inning ≤ 9): start from the per-team allotment (2) and subtract
 * failed challenges made anywhere in regulation; the count holds steady as long
 * as the team keeps winning challenges.
 *
 * Extra innings (inning > 9): the regulation allotment and any carryover are
 * wiped. Every team gets a flat grant (1) refreshed each extra inning, so only a
 * failed challenge made *in that same inning* consumes it. A team that reaches
 * extras with both challenges drops to one; a team that was out gets one back.
 *
 * The result floors at zero.
 */
export async function computeTeamChallengesRemaining(
  gamePk: number,
  teamId: number,
  inning: number
): Promise<number> {
  if (inning <= GAME_RULES.LAST_REGULATION_INNING) {
    const failedInRegulation = await prisma.livePitchEvent.count({
      where: {
        gamePk,
        challengerTeamId: teamId,
        hasReview: true,
        isOverturned: false,
        inning: { lte: GAME_RULES.LAST_REGULATION_INNING },
      },
    });
    return Math.max(
      0,
      GAME_RULES.DEFAULT_CHALLENGES_PER_TEAM - failedInRegulation
    );
  }

  const failedThisInning = await prisma.livePitchEvent.count({
    where: {
      gamePk,
      challengerTeamId: teamId,
      hasReview: true,
      isOverturned: false,
      inning,
    },
  });
  return Math.max(
    0,
    GAME_RULES.EXTRA_INNING_CHALLENGES_PER_INNING - failedThisInning
  );
}

/**
 * The current inning of a game, derived from the furthest-along stored data.
 * Falls back to inning 1 for a game with no pitches or snapshots yet.
 */
async function getCurrentInning(gamePk: number): Promise<number> {
  const maxPitchInning = await prisma.livePitchEvent.aggregate({
    where: { gamePk },
    _max: { inning: true },
  });
  if (maxPitchInning._max.inning != null) return maxPitchInning._max.inning;

  const latestSnapshot = await prisma.liveGameSnapshot.findFirst({
    where: { gamePk },
    orderBy: { inning: "desc" },
    select: { inning: true },
  });
  return latestSnapshot?.inning ?? 1;
}

/**
 * Recompute and persist both teams' challenges-remaining for a game so the
 * denormalized columns used for display stay current. The authoritative,
 * inning-aware derivation lives in computeTeamChallengesRemaining; this stores a
 * snapshot of it for the game's current inning. Idempotent and self-healing.
 */
export async function recomputeChallengesRemaining(gamePk: number): Promise<void> {
  const game = await prisma.game.findUnique({ where: { gamePk } });
  if (!game) return;

  const inning = await getCurrentInning(gamePk);
  const [homeRemaining, awayRemaining] = await Promise.all([
    computeTeamChallengesRemaining(gamePk, game.homeTeamId, inning),
    computeTeamChallengesRemaining(gamePk, game.awayTeamId, inning),
  ]);

  await prisma.game.update({
    where: { gamePk },
    data: {
      homeChallengesRemaining: homeRemaining,
      awayChallengesRemaining: awayRemaining,
      updatedAt: new Date(),
    },
  });
}

/**
 * Recompute challenge counts for every tracked game from their stored review
 * events. Run at startup to repair counts left corrupted by earlier
 * decrement-on-restart behavior. Returns the number of games reconciled.
 *
 * Runs sequentially: the game count is small (one day's schedule) and this
 * keeps startup well clear of the connection-pool limit.
 */
export async function reconcileAllChallengeCounts(): Promise<number> {
  const games = await prisma.game.findMany({ select: { gamePk: true } });
  for (const game of games) {
    await recomputeChallengesRemaining(game.gamePk);
  }
  return games.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// live_game_snapshots
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert the game state captured at the start of a new at-bat.
 * If the same (gamePk, atBatIndex) is seen again, the row is refreshed.
 */
export async function upsertAtBatSnapshot(
  snapshot: MlbAtBatSnapshot
): Promise<LiveGameSnapshot> {
  const sharedFields = {
    inning: snapshot.inning,
    halfInning: snapshot.halfInning,
    outs: snapshot.outs,
    runnerOnFirst: snapshot.runnerOnFirst,
    runnerOnSecond: snapshot.runnerOnSecond,
    runnerOnThird: snapshot.runnerOnThird,
    runnerFirstId: snapshot.runnerIds?.first ?? null,
    runnerSecondId: snapshot.runnerIds?.second ?? null,
    runnerThirdId: snapshot.runnerIds?.third ?? null,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
    batterId: snapshot.batterId,
    pitcherId: snapshot.pitcherId,
    battingTeamId: snapshot.battingTeamId,
    fieldingTeamId: snapshot.fieldingTeamId,
    fetchedAt: new Date(snapshot.fetchedAt),
    rawPayload: snapshot as object,
  };

  return prisma.liveGameSnapshot.upsert({
    where: {
      gamePk_atBatIndex: {
        gamePk: snapshot.gamePk,
        atBatIndex: snapshot.atBatIndex,
      },
    },
    update: sharedFields,
    create: {
      gamePk: snapshot.gamePk,
      atBatIndex: snapshot.atBatIndex,
      ...sharedFields,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// live_pitch_events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insert a pitch event, or update the call fields if the pitch already exists.
 * Idempotent by (gamePk, atBatIndex, pitchNumber). The poller already deduplicates,
 * but this provides a second safety net on the DB layer.
 */
export async function upsertPitchEvent(
  event: MlbLivePitchEvent
): Promise<LivePitchEvent> {
  const sharedFields = {
    callCode: event.callCode,
    callDescription: event.callDescription,
    hasReview: event.hasReview,
    isOverturned: event.isOverturned ?? null,
    challengerName: event.challengerName ?? null,
    challengerTeamId: event.challengerTeamId ?? null,
    fetchedAt: new Date(event.fetchedAt),
    rawPayload: event.raw as object,
  };

  return prisma.livePitchEvent.upsert({
    where: {
      gamePk_atBatIndex_pitchNumber: {
        gamePk: event.gamePk,
        atBatIndex: event.atBatIndex,
        pitchNumber: event.pitchNumber,
      },
    },
    update: sharedFields,
    create: {
      gamePk: event.gamePk,
      playId: event.playId,
      atBatIndex: event.atBatIndex,
      pitchNumber: event.pitchNumber,
      inning: event.inning,
      halfInning: event.halfInning,
      ballsBefore: event.ballsBefore,
      strikesBefore: event.strikesBefore,
      balls: event.balls,
      strikes: event.strikes,
      outs: event.outs,
      batterId: event.batterId,
      pitcherId: event.pitcherId,
      ...sharedFields,
    },
  });
}

/**
 * Fetch the most recent at-bat snapshot for a game.
 * Useful when the challenge service needs context for an event
 * that arrived before a snapshot was written to the DB.
 */
export async function findLatestAtBatSnapshot(
  gamePk: number
): Promise<LiveGameSnapshot | null> {
  return prisma.liveGameSnapshot.findFirst({
    where: { gamePk },
    orderBy: { atBatIndex: "desc" },
  });
}

/**
 * Returns every atBatIndex that already has a stored snapshot for this game.
 * Used on pipeline restart to skip re-ingesting historical at-bats.
 */
export async function findStoredAtBatIndices(gamePk: number): Promise<number[]> {
  const rows = await prisma.liveGameSnapshot.findMany({
    where: { gamePk },
    select: { atBatIndex: true },
    orderBy: { atBatIndex: "asc" },
  });
  return rows.map((row) => row.atBatIndex);
}
