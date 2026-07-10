import { prisma } from "../db/prisma";
import {
  applyRankingsDelta,
  recordTeamGameAppearances,
} from "../db/rankingsBucketRepository";
import { getTrackingStartDate } from "../utils/rankingsPeriod";
import {
  buildPitchReviewDelta,
  buildPostgameAuditDelta,
  negateRankingsEventDelta,
  seasonFromGameDate,
  type RankingsEventDelta,
  type RankingsGameContext,
} from "./rankingsDelta";
import {
  extractChallengerPlayerId,
} from "../db/playerNameRepository";
import { resolveGainedReForPitch } from "./rankingsGainedRe";

const SOURCE_PITCH_REVIEW = "pitch_review";
const SOURCE_POSTGAME_AUDIT = "postgame_audit";

function isWithinTrackingWindow(gameDate: string): boolean {
  return gameDate >= getTrackingStartDate();
}

async function loadGameContext(gamePk: number): Promise<RankingsGameContext | null> {
  const game = await prisma.game.findUnique({
    where: { gamePk },
    select: {
      gamePk: true,
      gameDate: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  return game;
}

async function contributionExists(
  sourceType: string,
  sourceId: number
): Promise<boolean> {
  const row = await prisma.rankingsContribution.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    select: { id: true },
  });
  return row !== null;
}

async function persistContribution(
  sourceType: string,
  sourceId: number,
  game: RankingsGameContext,
  delta: RankingsEventDelta
): Promise<boolean> {
  try {
    await prisma.rankingsContribution.create({
      data: {
        sourceType,
        sourceId,
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        season: seasonFromGameDate(game.gameDate),
        payloadJson: delta as object,
      },
    });
    return true;
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
}

async function applyAndRecord(
  sourceType: string,
  sourceId: number,
  game: RankingsGameContext,
  delta: RankingsEventDelta
): Promise<boolean> {
  if (!isWithinTrackingWindow(game.gameDate)) return false;

  const created = await persistContribution(sourceType, sourceId, game, delta);
  if (!created) return false;

  const season = seasonFromGameDate(game.gameDate);
  await applyRankingsDelta(game.gameDate, season, delta, game.gamePk, 1);
  return true;
}

function totalGainedReInDelta(delta: RankingsEventDelta): number {
  return delta.playerDeltas.reduce(
    (sum, row) => sum + (row.battingGainedRe ?? 0) + (row.fieldingGainedRe ?? 0),
    0
  );
}

/** Record both teams appearing in a tracked game (for gamesAppeared). */
export async function trackTeamGameAppearances(gamePk: number): Promise<void> {
  const game = await loadGameContext(gamePk);
  if (!game || !isWithinTrackingWindow(game.gameDate)) return;

  await recordTeamGameAppearances(
    game.gamePk,
    game.gameDate,
    seasonFromGameDate(game.gameDate),
    game.homeTeamId,
    game.awayTeamId
  );
}

/** Apply rankings delta when an ABS review is fully resolved on a pitch. */
export async function applyPitchReviewContribution(
  pitchEventId: number
): Promise<boolean> {
  if (await contributionExists(SOURCE_PITCH_REVIEW, pitchEventId)) {
    return false;
  }

  const pitch = await prisma.livePitchEvent.findUnique({
    where: { id: pitchEventId },
    select: {
      id: true,
      gamePk: true,
      hasReview: true,
      isOverturned: true,
      challengerTeamId: true,
      batterId: true,
      halfInning: true,
      atBatIndex: true,
      ballsBefore: true,
      strikesBefore: true,
      outs: true,
      callCode: true,
      rawPayload: true,
    },
  });
  if (!pitch) return false;

  const game = await loadGameContext(pitch.gamePk);
  if (!game) return false;

  const challengerPlayerId = extractChallengerPlayerId(pitch.rawPayload);
  const gainedRe =
    pitch.isOverturned === true ? await resolveGainedReForPitch(pitch) : 0;

  const delta = buildPitchReviewDelta(game, {
    pitchEventId: pitch.id,
    gamePk: pitch.gamePk,
    hasReview: pitch.hasReview,
    isOverturned: pitch.isOverturned,
    challengerTeamId: pitch.challengerTeamId,
    challengerPlayerId,
    batterId: pitch.batterId,
    halfInning: pitch.halfInning,
    gainedRe,
  });
  if (!delta) return false;

  return applyAndRecord(SOURCE_PITCH_REVIEW, pitchEventId, game, delta);
}

/** Apply rankings delta when a postgame audit row is written. */
export async function applyPostgameAuditContribution(
  auditId: number
): Promise<boolean> {
  if (await contributionExists(SOURCE_POSTGAME_AUDIT, auditId)) {
    return false;
  }

  const audit = await prisma.postgameChallengeAudit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      gamePk: true,
      pitchEventId: true,
      batterId: true,
      halfInning: true,
      missedChallenge: true,
      badChallengeAllowed: true,
      runExpectancySwing: true,
    },
  });
  if (!audit) return false;

  const [game, pitch] = await Promise.all([
    loadGameContext(audit.gamePk),
    prisma.livePitchEvent.findUnique({
      where: { id: audit.pitchEventId },
      select: {
        challengerTeamId: true,
        rawPayload: true,
      },
    }),
  ]);
  if (!game) return false;

  const delta = buildPostgameAuditDelta(game, {
    pitchEventId: audit.pitchEventId,
    batterId: audit.batterId,
    halfInning: audit.halfInning,
    missedChallenge: audit.missedChallenge,
    badChallengeAllowed: audit.badChallengeAllowed,
    runExpectancySwing: audit.runExpectancySwing,
    challengerPlayerId: pitch ? extractChallengerPlayerId(pitch.rawPayload) : null,
    challengerTeamId: pitch?.challengerTeamId ?? null,
  });
  if (!delta) return false;

  return applyAndRecord(SOURCE_POSTGAME_AUDIT, auditId, game, delta);
}

/** Process all audits for a game after postgame audit completes. */
export async function applyPostgameAuditContributionsForGame(
  gamePk: number
): Promise<number> {
  const audits = await prisma.postgameChallengeAudit.findMany({
    where: { gamePk },
    select: { id: true },
  });

  let applied = 0;
  for (const audit of audits) {
    if (await applyPostgameAuditContribution(audit.id)) applied++;
  }
  return applied;
}

/**
 * Repair pitch-review contributions that recorded overturns but missed gained RE
 * (e.g. recommendation not linked yet, or fielding-side ball challenges).
 * Idempotent — skips rows that already have gained RE credited.
 */
export async function repairMissingPitchReviewGainedRe(): Promise<number> {
  const contributions = await prisma.rankingsContribution.findMany({
    where: { sourceType: SOURCE_PITCH_REVIEW },
    orderBy: { id: "asc" },
  });

  let repaired = 0;

  for (const contribution of contributions) {
    const storedDelta = contribution.payloadJson as unknown as RankingsEventDelta;
    const hadOverturn = storedDelta.playerDeltas.some(
      (row) => (row.challengesOverturned ?? 0) > 0
    );
    if (!hadOverturn || totalGainedReInDelta(storedDelta) > 0) {
      continue;
    }

    const pitch = await prisma.livePitchEvent.findUnique({
      where: { id: contribution.sourceId },
      select: {
        id: true,
        gamePk: true,
        hasReview: true,
        isOverturned: true,
        challengerTeamId: true,
        batterId: true,
        halfInning: true,
        atBatIndex: true,
        ballsBefore: true,
        strikesBefore: true,
        outs: true,
        callCode: true,
        rawPayload: true,
      },
    });
    if (!pitch || pitch.isOverturned !== true) continue;

    const game = await loadGameContext(pitch.gamePk);
    if (!game || !isWithinTrackingWindow(game.gameDate)) continue;

    const challengerPlayerId = extractChallengerPlayerId(pitch.rawPayload);
    const gainedRe = await resolveGainedReForPitch(pitch);
    const correctedDelta = buildPitchReviewDelta(game, {
      pitchEventId: pitch.id,
      gamePk: pitch.gamePk,
      hasReview: pitch.hasReview,
      isOverturned: pitch.isOverturned,
      challengerTeamId: pitch.challengerTeamId,
      challengerPlayerId,
      batterId: pitch.batterId,
      halfInning: pitch.halfInning,
      gainedRe,
    });
    if (!correctedDelta || totalGainedReInDelta(correctedDelta) <= 0) continue;

    const season = seasonFromGameDate(game.gameDate);
    await applyRankingsDelta(
      contribution.gameDate,
      season,
      negateRankingsEventDelta(storedDelta),
      contribution.gamePk,
      1
    );
    await applyRankingsDelta(
      contribution.gameDate,
      season,
      correctedDelta,
      contribution.gamePk,
      1
    );
    await prisma.rankingsContribution.update({
      where: { id: contribution.id },
      data: { payloadJson: correctedDelta as object },
    });
    repaired++;
  }

  if (repaired > 0) {
    console.log(
      `[rankingsRepair] credited missing gained RE on ${repaired} pitch review(s)`
    );
  }

  return repaired;
}
