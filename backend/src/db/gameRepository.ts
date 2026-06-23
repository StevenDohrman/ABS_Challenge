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
  await prisma.game.updateMany({
    where: { gamePk },
    data: { status: "Final", updatedAt: new Date() },
  });
}

/**
 * Returns the game row for the given gamePk, or null if not found.
 */
export async function findGame(gamePk: number): Promise<Game | null> {
  return prisma.game.findUnique({ where: { gamePk } });
}

/**
 * Decrement the challenge count for the batting team by one.
 * halfInning "top" = away team bats, "bottom" = home team bats.
 * The count floors at zero and never goes negative.
 */
export async function decrementChallengesRemaining(
  gamePk: number,
  halfInning: "top" | "bottom"
): Promise<void> {
  if (halfInning === "top") {
    await prisma.game.updateMany({
      where: { gamePk, awayChallengesRemaining: { gt: 0 } },
      data: { awayChallengesRemaining: { decrement: 1 }, updatedAt: new Date() },
    });
  } else {
    await prisma.game.updateMany({
      where: { gamePk, homeChallengesRemaining: { gt: 0 } },
      data: { homeChallengesRemaining: { decrement: 1 }, updatedAt: new Date() },
    });
  }
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
