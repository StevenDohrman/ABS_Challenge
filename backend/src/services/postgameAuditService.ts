/**
 * Postgame challenge audit logic.
 *
 * Joins live pitch events with MLB live feed pitch location data to evaluate
 * missed challenges and bad allowed challenges.
 *
 * Missed value is always the calculated raw RE swing from overturning the call
 * (zone disagrees with live call). Engine recommendation labels (ALLOW/DENY/WARN)
 * are stored for context but do not gate whether a miss is counted.
 *
 * Audits both sides:
 *   - Batting: called strike that was actually a ball
 *   - Fielding: called ball that was actually a strike
 */

import type { ChallengeRecommendation, LivePitchEvent } from "@prisma/client";
import {
  CALLED_STRIKE_CALL_CODE,
  extractPitchLocationFromPlayEvent,
} from "@abs/data-pipeline";
import {
  upsertPostgameAudits,
  findAuditsForGame,
  type PostgameAuditInput,
  type ZoneResult,
  type OriginalCall,
  type ChallengeSide,
} from "../db/postgameAuditRepository";
import { markPostgameAudited, computeTeamChallengesRemaining } from "../db/gameRepository";
import { applyPostgameAuditContributionsForGame } from "./rankingsIncrementalService";
import { rawOverturnReSwing } from "./rankingsGainedRe";
import { battingSideFromHalfInning } from "../dto/postgame";
import { CALL_CODES } from "../db/constants";

export type { ZoneResult, OriginalCall, ChallengeSide, PostgameAuditInput };

const PLATE_HALF_WIDTH_FT = 0.83;
const NEGATIVE_RECS = new Set(["DENY", "WARN"]);

export interface AtBatSnapshotForAudit {
  outs: number;
  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;
  fieldingTeamId: number;
  battingTeamId: number;
}

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
  if (callCode === CALL_CODES.BALL) return "ball";
  return "unknown";
}

function teamOverturnedChallenge(pitch: LivePitchEvent): boolean {
  return pitch.hasReview && pitch.isOverturned === true;
}

function runnersFromSnapshot(snapshot: AtBatSnapshotForAudit | undefined) {
  return snapshot
    ? {
        first: snapshot.runnerOnFirst,
        second: snapshot.runnerOnSecond,
        third: snapshot.runnerOnThird,
      }
    : { first: false, second: false, third: false };
}

/** Raw offensive RE swing from overturning this call at the at-bat snapshot. */
export function computeCalculatedReSwing(
  pitch: LivePitchEvent,
  snapshot: AtBatSnapshotForAudit | undefined
): number {
  const outs = snapshot?.outs ?? pitch.outs;
  return rawOverturnReSwing(
    outs,
    pitch.ballsBefore,
    pitch.strikesBefore,
    runnersFromSnapshot(snapshot)
  );
}

function buildSharedAuditFields(
  pitch: LivePitchEvent,
  zoneResult: ZoneResult,
  notes: string[]
) {
  return {
    gamePk: pitch.gamePk,
    atBatIndex: pitch.atBatIndex,
    pitchNumber: pitch.pitchNumber,
    pitchEventId: pitch.id,
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
    notes,
  };
}

function resolveMissedFromWrongCall(
  callWasProbablyWrong: boolean,
  runExpectancySwing: number,
  pitch: LivePitchEvent
): { shouldHaveChallenged: boolean; missedChallenge: boolean } {
  const shouldHaveChallenged = callWasProbablyWrong && runExpectancySwing > 0;
  const missedChallenge =
    shouldHaveChallenged && !teamOverturnedChallenge(pitch);
  return { shouldHaveChallenged, missedChallenge };
}

/** Batting-side audit: called strike where zone location disagrees. */
export function buildBattingAuditInput(
  pitch: LivePitchEvent,
  snapshot: AtBatSnapshotForAudit | undefined,
  recommendation: ChallengeRecommendation | null,
  challengeAvailable: boolean
): PostgameAuditInput | null {
  if (pitch.callCode !== CALLED_STRIKE_CALL_CODE) return null;

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

  const runExpectancySwing = computeCalculatedReSwing(pitch, snapshot);
  const { shouldHaveChallenged, missedChallenge } = resolveMissedFromWrongCall(
    callWasProbablyWrong,
    runExpectancySwing,
    pitch
  );

  const liveRecommendation = recommendation?.recommendation ?? "NONE";

  const badChallengeAllowed =
    pitch.hasReview &&
    recommendation !== null &&
    NEGATIVE_RECS.has(liveRecommendation) &&
    mapLiveCall(pitch.callCode) === "strike";

  return {
    ...buildSharedAuditFields(pitch, zoneResult, notes),
    challengeSide: "batting",
    recommendationId: recommendation?.id ?? null,
    callWasProbablyWrong,
    liveRecommendation,
    playerConfidence: recommendation?.minimumConfidenceRequired ?? null,
    challengeAvailable:
      recommendation?.challengeAvailable ?? challengeAvailable,
    shouldHaveChallenged,
    missedChallenge,
    badChallengeAllowed,
    runExpectancySwing,
  };
}

/** Fielding-side audit: called ball that Statcast location shows was a strike. */
export function buildFieldingAuditInput(
  pitch: LivePitchEvent,
  snapshot: AtBatSnapshotForAudit | undefined,
  challengeAvailable: boolean
): PostgameAuditInput | null {
  if (pitch.callCode !== CALL_CODES.BALL) return null;

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
    mapLiveCall(pitch.callCode) === "ball" && zoneResult === "strike";

  const runExpectancySwing = computeCalculatedReSwing(pitch, snapshot);
  const { shouldHaveChallenged, missedChallenge } = resolveMissedFromWrongCall(
    callWasProbablyWrong,
    runExpectancySwing,
    pitch
  );

  return {
    ...buildSharedAuditFields(pitch, zoneResult, notes),
    challengeSide: "fielding",
    recommendationId: null,
    callWasProbablyWrong,
    liveRecommendation: "FIELDING",
    playerConfidence: null,
    challengeAvailable,
    shouldHaveChallenged,
    missedChallenge,
    badChallengeAllowed: false,
    runExpectancySwing,
  };
}

/** @deprecated Use buildBattingAuditInput — kept for tests. */
export function buildAuditInput(
  pitch: LivePitchEvent,
  recommendation: ChallengeRecommendation
): PostgameAuditInput | null {
  return buildBattingAuditInput(
    pitch,
    {
      outs: pitch.outs,
      runnerOnFirst: false,
      runnerOnSecond: false,
      runnerOnThird: false,
      fieldingTeamId: 0,
      battingTeamId: 0,
    },
    recommendation,
    recommendation.challengeAvailable
  );
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

  const [pitches, recommendations, snapshots, game] = await Promise.all([
    prisma.livePitchEvent.findMany({ where: { gamePk } }),
    prisma.challengeRecommendation.findMany({ where: { gamePk } }),
    prisma.liveGameSnapshot.findMany({ where: { gamePk } }),
    prisma.game.findUnique({
      where: { gamePk },
      select: { homeTeamId: true, awayTeamId: true },
    }),
  ]);

  const recByCount = new Map<string, ChallengeRecommendation>();
  for (const rec of recommendations) {
    recByCount.set(`${rec.atBatIndex}-${rec.balls}-${rec.strikes}`, rec);
  }

  const snapshotByAtBat = new Map(
    snapshots.map((snap) => [
      snap.atBatIndex,
      {
        outs: snap.outs,
        runnerOnFirst: snap.runnerOnFirst,
        runnerOnSecond: snap.runnerOnSecond,
        runnerOnThird: snap.runnerOnThird,
        fieldingTeamId: snap.fieldingTeamId,
        battingTeamId: snap.battingTeamId,
      } satisfies AtBatSnapshotForAudit,
    ])
  );

  const challengeAvailabilityCache = new Map<string, boolean>();

  async function teamChallengeAvailable(
    teamId: number,
    inning: number
  ): Promise<boolean> {
    const key = `${teamId}-${inning}`;
    if (!challengeAvailabilityCache.has(key)) {
      const remaining = await computeTeamChallengesRemaining(
        gamePk,
        teamId,
        inning
      );
      challengeAvailabilityCache.set(key, remaining > 0);
    }
    return challengeAvailabilityCache.get(key)!;
  }

  const audits: PostgameAuditInput[] = [];

  for (const pitch of pitches) {
    const snapshot = snapshotByAtBat.get(pitch.atBatIndex);

    if (pitch.callCode === CALLED_STRIKE_CALL_CODE) {
      const rec =
        recByCount.get(
          `${pitch.atBatIndex}-${pitch.ballsBefore}-${pitch.strikesBefore}`
        ) ?? null;

      const battingTeamId =
        snapshot?.battingTeamId ??
        (battingSideFromHalfInning(pitch.halfInning) === "away"
          ? game?.awayTeamId
          : game?.homeTeamId);

      if (battingTeamId === undefined) continue;

      const challengeAvailable = await teamChallengeAvailable(
        battingTeamId,
        pitch.inning
      );

      const audit = buildBattingAuditInput(
        pitch,
        snapshot,
        rec,
        challengeAvailable
      );
      if (audit) audits.push(audit);
      continue;
    }

    if (pitch.callCode === CALL_CODES.BALL) {
      const fieldingTeamId =
        snapshot?.fieldingTeamId ??
        (battingSideFromHalfInning(pitch.halfInning) === "away"
          ? game?.homeTeamId
          : game?.awayTeamId);

      if (fieldingTeamId === undefined) continue;

      const challengeAvailable = await teamChallengeAvailable(
        fieldingTeamId,
        pitch.inning
      );

      const audit = buildFieldingAuditInput(
        pitch,
        snapshot,
        challengeAvailable
      );
      if (audit) audits.push(audit);
    }
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
