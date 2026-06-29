/**
 * Postgame challenge audit logic.
 *
 * Joins live pitch events + triggered recommendations with Savant location
 * data to evaluate missed challenges and bad allowed challenges.
 *
 * All zone/call logic lives here — the engine stays pure.
 */

import type {
  ChallengeRecommendation,
  LivePitchEvent,
  SavantPitchEvent,
} from "@prisma/client";
import type { SavantPitchRow } from "@abs/data-pipeline";
import { CALLED_STRIKE_CALL_CODE } from "@abs/data-pipeline";
import {
  upsertSavantPitchEvents,
  findSavantPitchesForGame,
  upsertPostgameAudits,
  findAuditsForGame,
  type PostgameAuditInput,
  type SavantZoneResult,
  type OriginalCall,
} from "../db/postgameAuditRepository";
import { markSavantEnriched, incrementSavantEnrichmentAttempt } from "../db/gameRepository";

export type { SavantZoneResult, OriginalCall, PostgameAuditInput };

const POSITIVE_RECS = new Set(["AUTO_ALLOW", "ALLOW"]);
const NEGATIVE_RECS = new Set(["DENY", "WARN"]);

/** Savant zones 1–9 are in the strike zone; 11–14 are shadow/out-of-zone. */
export function deriveSavantZoneResult(
  zone: number | null,
  plateX: number | null,
  plateZ: number | null,
  szTop: number | null,
  szBot: number | null
): SavantZoneResult {
  if (zone !== null) {
    if (zone >= 1 && zone <= 9) return "strike";
    if (zone >= 11 && zone <= 14) return "ball";
  }

  if (
    plateX !== null &&
    plateZ !== null &&
    szTop !== null &&
    szBot !== null
  ) {
    const halfWidth = 0.83; // standard plate half-width in feet
    const inZone =
      Math.abs(plateX) <= halfWidth &&
      plateZ >= szBot &&
      plateZ <= szTop;
    return inZone ? "strike" : "ball";
  }

  return "unknown";
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
  recommendation: ChallengeRecommendation,
  savant: SavantPitchEvent | null
): PostgameAuditInput | null {
  if (pitch.callCode !== CALLED_STRIKE_CALL_CODE) return null;
  if (recommendation.triggeredAt === null) return null;

  const notes: string[] = [];
  if (!savant) {
    notes.push("No matching Savant pitch row");
  } else if (
    savant.batterId !== pitch.batterId ||
    savant.pitcherId !== pitch.pitcherId
  ) {
    notes.push("Savant row matched by index but batter/pitcher IDs differ");
  }

  const savantZoneResult = savant
    ? deriveSavantZoneResult(
        savant.zone,
        savant.plateX,
        savant.plateZ,
        savant.szTop,
        savant.szBot
      )
    : "unknown";

  const callWasProbablyWrong =
    mapLiveCall(pitch.callCode) === "strike" && savantZoneResult === "ball";

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
    savantPitchEventId: savant?.id ?? null,
    inning: pitch.inning,
    halfInning: pitch.halfInning,
    balls: pitch.ballsBefore,
    strikes: pitch.strikesBefore,
    outs: pitch.outs,
    batterId: pitch.batterId,
    pitcherId: pitch.pitcherId,
    originalCall: mapLiveCall(pitch.callCode),
    plateX: savant?.plateX ?? null,
    plateZ: savant?.plateZ ?? null,
    szTop: savant?.szTop ?? null,
    szBot: savant?.szBot ?? null,
    savantZoneResult,
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

function indexSavantByAtBatIndex(
  rows: SavantPitchEvent[]
): Map<string, SavantPitchEvent> {
  const map = new Map<string, SavantPitchEvent>();
  for (const row of rows) {
    map.set(`${row.atBatIndex}-${row.pitchNumber}`, row);
  }
  return map;
}

export async function persistSavantPitchesAndAudit(
  gamePk: number,
  pitches: SavantPitchRow[]
): Promise<void> {
  await upsertSavantPitchEvents(gamePk, pitches);
  await auditGame(gamePk);
  await markSavantEnriched(gamePk);
}

export async function auditGame(gamePk: number): Promise<number> {
  const { prisma } = await import("../db/prisma");

  const [pitches, recommendations, savantRows] = await Promise.all([
    prisma.livePitchEvent.findMany({ where: { gamePk } }),
    prisma.challengeRecommendation.findMany({
      where: { gamePk, triggeredAt: { not: null } },
    }),
    findSavantPitchesForGame(gamePk),
  ]);

  const savantByKey = indexSavantByAtBatIndex(savantRows);
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

    const savant =
      savantByKey.get(`${pitch.atBatIndex}-${pitch.pitchNumber}`) ?? null;
    const audit = buildAuditInput(pitch, rec, savant);
    if (audit) audits.push(audit);
  }

  await upsertPostgameAudits(audits);
  return audits.length;
}

export async function recordSavantEnrichmentAttempt(gamePk: number): Promise<void> {
  await incrementSavantEnrichmentAttempt(gamePk);
}

export { findAuditsForGame };
