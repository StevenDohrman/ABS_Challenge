/**
 * Backfill Final games from the MLB archived live feed when they were not
 * tracked live (or were only partially ingested).
 *
 * Flow per game:
 *   1. Fetch archived feed
 *   2. Upsert game row + finalizedAt
 *   3. Ingest all at-bats + pre-compute recommendations (gameBackfillService)
 *   4. Replay all pitch events + trigger called-strike recommendations
 *   5. Recompute challenge counts
 *   6. Schedule Savant postgame enrichment
 */

import type { ActiveGame, MlbLivePitchEvent } from "@abs/data-pipeline";
import {
  fetchLiveFeed,
  fetchFinalGamesInRange,
  buildFinalGameBackfillPayload,
  inferFinalizedAtFromFeed,
  parsePitchEvents,
} from "@abs/data-pipeline";
import { prisma } from "../db/prisma";
import {
  ensureGameFinalized,
  recomputeChallengesRemaining,
} from "../db/gameRepository";
import { handleGameDiscovered } from "./ingestService";
import { processGameBackfill } from "./gameBackfillService";
import { handlePitchEvent } from "./ingestService";
import { triggerRecommendationIfCalledStrike } from "./challengeService";
import { scheduleSavantPostgameEnrichment } from "./postgameScheduler";
import { enqueuePipelineDbWork } from "../db/pipelineDbQueue";

export interface FinalBackfillScanResult {
  candidates: number;
  backfilled: number;
  skipped: number;
  failed: number;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function countIngestedAtBats(gamePk: number): Promise<number> {
  return prisma.liveGameSnapshot.count({ where: { gamePk } });
}

async function countIngestedPitches(gamePk: number): Promise<number> {
  return prisma.livePitchEvent.count({ where: { gamePk } });
}

/**
 * True when the game is missing snapshots or pitch events relative to the feed.
 */
export async function gameNeedsFinalBackfill(
  gamePk: number,
  expectedAtBatCount: number,
  expectedPitchCount: number
): Promise<boolean> {
  const existing = await prisma.game.findUnique({ where: { gamePk } });
  if (!existing) return true;

  const [atBatCount, pitchCount] = await Promise.all([
    countIngestedAtBats(gamePk),
    countIngestedPitches(gamePk),
  ]);

  if (atBatCount < expectedAtBatCount) return true;
  if (pitchCount < expectedPitchCount) return true;
  return false;
}

async function replayPitchEvents(events: MlbLivePitchEvent[]): Promise<void> {
  const sorted = [...events].sort(
    (a, b) => a.atBatIndex - b.atBatIndex || a.pitchNumber - b.pitchNumber
  );

  for (const event of sorted) {
    const dbRowId = await handlePitchEvent(event);
    if (dbRowId !== null) {
      await triggerRecommendationIfCalledStrike(event, dbRowId);
    }
  }
}

/**
 * Backfill a single Final game from the MLB archived live feed.
 * Idempotent — skips work already present in the DB.
 */
export async function backfillFinalGame(
  activeGame: ActiveGame
): Promise<boolean> {
  const { gamePk } = activeGame;
  const fetchedAt = new Date().toISOString();

  const feed = await fetchLiveFeed(gamePk);
  if (feed.gameData?.status?.abstractGameState !== "Final") {
    console.log(`[finalGameBackfill] game=${gamePk} — not Final in feed, skipping`);
    return false;
  }

  const payload = buildFinalGameBackfillPayload(feed, fetchedAt);
  const pitchEvents = parsePitchEvents(feed, fetchedAt);

  if (payload.snapshots.length === 0) {
    console.warn(`[finalGameBackfill] game=${gamePk} — no at-bats in feed, skipping`);
    return false;
  }

  const needsBackfill = await gameNeedsFinalBackfill(
    gamePk,
    payload.snapshots.length,
    pitchEvents.length
  );

  if (!needsBackfill) {
    console.log(`[finalGameBackfill] game=${gamePk} — already fully ingested`);
    await ensureGameFinalized(gamePk, inferFinalizedAtFromFeed(feed));
    scheduleSavantPostgameEnrichment(gamePk);
    return false;
  }

  console.log(
    `[finalGameBackfill] game=${gamePk} — backfilling ${payload.snapshots.length} at-bats, ` +
      `${pitchEvents.length} pitches, ${payload.calledStrikeAtBatIndices.length} called-strike at-bats`
  );

  await handleGameDiscovered({ ...activeGame, status: "Final" });
  await ensureGameFinalized(gamePk, inferFinalizedAtFromFeed(feed));

  await new Promise<void>((resolve) => {
    void processGameBackfill(payload, resolve);
  });

  await replayPitchEvents(pitchEvents);
  await recomputeChallengesRemaining(gamePk);
  scheduleSavantPostgameEnrichment(gamePk);

  console.log(`[finalGameBackfill] game=${gamePk} — backfill complete`);
  return true;
}

/**
 * Scan the retention window for Final MLB games and backfill any that were
 * not tracked live or are missing pitch/recommendation data.
 */
export async function scanAndBackfillFinalGames(
  retentionDays: number
): Promise<FinalBackfillScanResult> {
  const startDate = dateDaysAgo(retentionDays);
  const endDate = todayDate();

  console.log(
    `[finalGameBackfill] scanning Final games ${startDate} → ${endDate}`
  );

  const finalGames = await fetchFinalGamesInRange(startDate, endDate);
  const result: FinalBackfillScanResult = {
    candidates: finalGames.length,
    backfilled: 0,
    skipped: 0,
    failed: 0,
  };

  for (const activeGame of finalGames) {
    try {
      const didBackfill = await enqueuePipelineDbWork(
        `final-backfill game=${activeGame.gamePk}`,
        () => backfillFinalGame(activeGame),
        "low"
      );
      if (didBackfill) result.backfilled++;
      else result.skipped++;
    } catch (err) {
      result.failed++;
      console.error(
        `[finalGameBackfill] game=${activeGame.gamePk} failed:`,
        err
      );
    }
  }

  console.log(
    `[finalGameBackfill] scan complete — ${result.backfilled} backfilled, ` +
      `${result.skipped} skipped, ${result.failed} failed (${result.candidates} candidates)`
  );

  return result;
}

/**
 * Backfill one game by gamePk (looks up schedule metadata if needed).
 */
export async function backfillFinalGameByPk(gamePk: number): Promise<boolean> {
  const games = await fetchFinalGamesInRange(todayDate(), todayDate());
  let activeGame = games.find((g) => g.gamePk === gamePk);

  if (!activeGame) {
    // Search retention window
    const windowGames = await fetchFinalGamesInRange(
      dateDaysAgo(7),
      todayDate()
    );
    activeGame = windowGames.find((g) => g.gamePk === gamePk);
  }

  if (!activeGame) {
    const feed = await fetchLiveFeed(gamePk);
    if (feed.gameData?.status?.abstractGameState !== "Final") {
      throw new Error(`Game ${gamePk} is not Final`);
    }
    const teams = feed.gameData.teams;
    activeGame = {
      gamePk,
      officialDate: feed.gameData.datetime.officialDate,
      scheduledStartTime: feed.gameData.datetime.dateTime,
      status: "Final",
      detailedState: feed.gameData.status.detailedState,
      homeTeamId: teams.home.team.id,
      homeTeamName: teams.home.team.name,
      awayTeamId: teams.away.team.id,
      awayTeamName: teams.away.team.name,
    };
  }

  return backfillFinalGame(activeGame);
}
