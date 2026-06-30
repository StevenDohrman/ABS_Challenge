import { prisma } from "../db/prisma";
import { backfillPlayerNamesFromExistingData } from "../db/playerNameRepository";
import {
  applyPitchReviewContribution,
  applyPostgameAuditContribution,
  trackTeamGameAppearances,
} from "./rankingsIncrementalService";

/**
 * One-time / startup catch-up for games ingested before incremental rankings existed,
 * or rows missed during a partial run. Idempotent — skips contributions already recorded.
 */
export async function backfillMissingRankingsContributions(): Promise<{
  pitchReviews: number;
  audits: number;
  teamGames: number;
  playerNames: number;
}> {
  const result = { pitchReviews: 0, audits: 0, teamGames: 0, playerNames: 0 };

  result.playerNames = await backfillPlayerNamesFromExistingData();

  const resolvedReviews = await prisma.livePitchEvent.findMany({
    where: {
      hasReview: true,
      isOverturned: { not: null },
      challengerTeamId: { not: null },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  for (const pitch of resolvedReviews) {
    if (await applyPitchReviewContribution(pitch.id)) {
      result.pitchReviews++;
    }
  }

  const audits = await prisma.postgameChallengeAudit.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  for (const audit of audits) {
    if (await applyPostgameAuditContribution(audit.id)) {
      result.audits++;
    }
  }

  const games = await prisma.game.findMany({
    select: { gamePk: true },
    orderBy: { gamePk: "asc" },
  });

  for (const game of games) {
    await trackTeamGameAppearances(game.gamePk);
    result.teamGames++;
  }

  if (result.pitchReviews > 0 || result.audits > 0) {
    console.log(
      `[rankingsBackfill] applied ${result.pitchReviews} pitch reviews, ` +
        `${result.audits} audits, ${result.teamGames} team game appearances`
    );
  }

  return result;
}
