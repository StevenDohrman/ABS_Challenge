/**
 * Postgame challenge audit logic.
 *
 * Joins live pitch events + triggered recommendations with MLB live feed
 * pitch location data to evaluate missed challenges and bad allowed challenges.
 *
 * All zone/call logic lives here — the engine stays pure.
 */

import type { ChallengeRecommendation, LivePitchEvent } from "@prisma/client";
import { CALLED_STRIKE_CALL_CODE, extractPitchLocationFromPlayEvent } from "@abs/data-pipeline";
import {
  upsertPostgameAudits,
  findAuditsForGame,
  type PostgameAuditInput,
  type ZoneResult,
  type OriginalCall,
} from "../db/postgameAuditRepository";
import { markPostgameAudited } from "../db/gameRepository";
import { applyPostgameAuditContributionsForGame } from "./rankingsIncrementalService";

export type { ZoneResult, OriginalCall, PostgameAuditInput };

const PLATE_HALF_WIDTH_FT = 0.83;
const POSITIVE_RECS = new Set(["AUTO_ALLOW", "ALLOW"]);
const NEGATIVE_RECS = new Set(["DENY", "WARN"]);

/** MLB zones 1–9 are in the strike zone; 11–14 are shadow/out-of-zone. */
export function deriveMlbZoneResult(
  mlbZone: number | null,
  plateX: number | null,
  plateZ: number | null,
  strikeZoneTop: number | null,
  strikeZoneBottom: number | null
): ZoneResult {
  if (mlbZone !== null) {
    if (mlbZone >= 1 && mlbZone <= 9) return "strike";
    if (mlbZone >= 11 && mlbZone <= 14) return "ball";
  }

  if (
    plateX !== null &&
    plateZ !== null &&
    strikeZoneTop !== null &&
    strikeZoneBottom !== null
  ) {
    const inZone =
      Math.abs(plateX) <= PLATE_HALF_WIDTH_FT &&
      plateZ >= strikeZoneBottom &&
      plateZ <= strikeZoneTop;
    return inZone ? "strike" : "ball";
  }

  return "unknown";
}

function pitchHasLocation(pitch: LivePitchEvent): boolean {
  return (
    pitch.plateX !== null &&
    pitch.plateZ !== null &&
    pitch.strikeZoneTop !== null &&
    pitch.strikeZoneBottom !== null
  );
}

function mapLiveCall(callCode: string | null): OriginalCall {
  if (callCode === CALLED_STRIKE_CALL_CODE) return "strike";
  if (callCode === "B") return "ball";
  return "unknown";
}

function teamOverturnedChallenge(pitch: LivePitchEvent): boolean {
  return pitch.hasReview && pitch.isOverturned === true;
}

export function buildAuditInput(
  pitch: LivePitchEvent,
  recommendation: ChallengeRecommendation
): PostgameAuditInput | null {
  if (pitch.callCode !== CALLED_STRIKE_CALL_CODE) return null;
  if (recommendation.triggeredAt === null) return null;

  const notes: string[] = [];
  if (!pitchHasLocation(pitch)) {
    notes.push("No pitch location data in MLB live feed");
  }

  const zoneResult = deriveMlbZoneResult(
    pitch.mlbZone,
    pitch.plateX,
    pitch.plateZ,
    pitch.strikeZoneTop,
    pitch.strikeZoneBottom
  );

  const callWasProbablyWrong =
    mapLiveCall(pitch.callCode) === "strike" && zoneResult === "ball";

  const liveRecommendation = recommendation.recommendation;
  const shouldHaveChallenged =
    POSITIVE_RECS.has(liveRecommendation) && callWasProbablyWrong;

  const missedChallenge =
    shouldHaveChallenged && !teamOverturnedChallenge(pitch);

  const badChallengeAllowed =
    pitch.hasReview &&
    NEGATIVE_RECS.has(liveRecommendation) &&
    mapLiveCall(pitch.callCode) === "strike";

  return {
    gamePk: pitch.gamePk,
    atBatIndex: pitch.atBatIndex,
    pitchNumber: pitch.pitchNumber,
    pitchEventId: pitch.id,
    recommendationId: recommendation.id,
    inning: pitch.inning,
    halfInning: pitch.halfInning,
    balls: pitch.ballsBefore,
    strikes: pitch.strikesBefore,
    outs: pitch.outs,
    batterId: pitch.batterId,
    pitcherId: pitch.pitcherId,
    originalCall: mapLiveCall(pitch.callCode),
    plateX: pitch.plateX,
    plateZ: pitch.plateZ,
    szTop: pitch.strikeZoneTop,
    szBot: pitch.strikeZoneBottom,
    zoneResult,
    callWasProbablyWrong,
    liveRecommendation,
    playerConfidence: recommendation.minimumConfidenceRequired,
    challengeAvailable: recommendation.challengeAvailable,
    shouldHaveChallenged,
    missedChallenge,
    badChallengeAllowed,
    runExpectancySwing: recommendation.expectedValue,
    notes,
  };
}

/**
 * Backfill pitch location columns from stored rawPayload when live poll omitted pitchData.
 */
export async function enrichPitchLocationsFromRawPayload(
  gamePk: number
): Promise<number> {
  const { prisma } = await import("../db/prisma");
  const pitches = await prisma.livePitchEvent.findMany({
    where: {
      gamePk,
      plateX: null,
      plateZ: null,
    },
  });

  let updated = 0;
  for (const pitch of pitches) {
    const location = extractPitchLocationFromPlayEvent(pitch.rawPayload);
    if (
      location.plateX === undefined &&
      location.plateZ === undefined &&
      location.strikeZoneTop === undefined &&
      location.strikeZoneBottom === undefined &&
      location.mlbZone === undefined
    ) {
      continue;
    }

    await prisma.livePitchEvent.update({
      where: { id: pitch.id },
      data: {
        plateX: location.plateX ?? null,
        plateZ: location.plateZ ?? null,
        strikeZoneTop: location.strikeZoneTop ?? null,
        strikeZoneBottom: location.strikeZoneBottom ?? null,
        mlbZone: location.mlbZone ?? null,
      },
    });
    updated++;
  }

  return updated;
}

export async function auditGame(gamePk: number): Promise<number> {
  const { prisma } = await import("../db/prisma");

  const [pitches, recommendations] = await Promise.all([
    prisma.livePitchEvent.findMany({ where: { gamePk } }),
    prisma.challengeRecommendation.findMany({
      where: { gamePk, triggeredAt: { not: null } },
    }),
  ]);

  const recByCount = new Map<string, ChallengeRecommendation>();
  for (const rec of recommendations) {
    recByCount.set(`${rec.atBatIndex}-${rec.balls}-${rec.strikes}`, rec);
  }

  const audits: PostgameAuditInput[] = [];

  for (const pitch of pitches) {
    const rec = recByCount.get(
      `${pitch.atBatIndex}-${pitch.ballsBefore}-${pitch.strikesBefore}`
    );
    if (!rec) continue;

    const audit = buildAuditInput(pitch, rec);
    if (audit) audits.push(audit);
  }

  await upsertPostgameAudits(audits);
  await applyPostgameAuditContributionsForGame(gamePk);
  return audits.length;
}

/** Run postgame audit for a Final game using MLB live feed pitch location data. */
export async function runPostgameAudit(gamePk: number): Promise<void> {
  await enrichPitchLocationsFromRawPayload(gamePk);
  const count = await auditGame(gamePk);
  await markPostgameAudited(gamePk);
  console.log(
    `[postgameAuditService] audit complete for game ${gamePk} (${count} rows)`
  );
}

export { findAuditsForGame };
