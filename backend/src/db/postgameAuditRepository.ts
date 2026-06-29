import { prisma } from "./prisma";
import type { SavantPitchRow } from "@abs/data-pipeline";
import type { PostgameChallengeAudit, SavantPitchEvent } from "@prisma/client";

export type SavantZoneResult = "ball" | "strike" | "unknown";
export type OriginalCall = "ball" | "strike" | "unknown";

export interface PostgameAuditInput {
  gamePk: number;
  atBatIndex: number;
  pitchNumber: number;
  pitchEventId: number;
  recommendationId: number;
  savantPitchEventId: number | null;
  inning: number;
  halfInning: string;
  balls: number;
  strikes: number;
  outs: number;
  batterId: number;
  pitcherId: number;
  originalCall: OriginalCall;
  plateX: number | null;
  plateZ: number | null;
  szTop: number | null;
  szBot: number | null;
  savantZoneResult: SavantZoneResult;
  callWasProbablyWrong: boolean;
  liveRecommendation: string;
  playerConfidence: number | null;
  challengeAvailable: boolean;
  shouldHaveChallenged: boolean;
  missedChallenge: boolean;
  badChallengeAllowed: boolean;
  runExpectancySwing: number;
  notes: string[];
}

export async function upsertSavantPitchEvents(
  gamePk: number,
  pitches: SavantPitchRow[]
): Promise<void> {
  for (const pitch of pitches) {
    const atBatIndex = pitch.atBatNumber - 1;
    await prisma.savantPitchEvent.upsert({
      where: {
        gamePk_atBatNumber_pitchNumber: {
          gamePk,
          atBatNumber: pitch.atBatNumber,
          pitchNumber: pitch.pitchNumber,
        },
      },
      update: {
        atBatIndex,
        batterId: pitch.batterId,
        pitcherId: pitch.pitcherId,
        plateX: pitch.plateX,
        plateZ: pitch.plateZ,
        szTop: pitch.szTop,
        szBot: pitch.szBot,
        zone: pitch.zone !== null ? Math.round(pitch.zone) : null,
        description: pitch.description,
        fetchedAt: new Date(pitch.fetchedAt),
        rawPayload: pitch.raw,
      },
      create: {
        gamePk,
        atBatNumber: pitch.atBatNumber,
        atBatIndex,
        pitchNumber: pitch.pitchNumber,
        batterId: pitch.batterId,
        pitcherId: pitch.pitcherId,
        plateX: pitch.plateX,
        plateZ: pitch.plateZ,
        szTop: pitch.szTop,
        szBot: pitch.szBot,
        zone: pitch.zone !== null ? Math.round(pitch.zone) : null,
        description: pitch.description,
        fetchedAt: new Date(pitch.fetchedAt),
        rawPayload: pitch.raw,
      },
    });
  }
}

export async function findSavantPitchesForGame(
  gamePk: number
): Promise<SavantPitchEvent[]> {
  return prisma.savantPitchEvent.findMany({
    where: { gamePk },
    orderBy: [{ atBatIndex: "asc" }, { pitchNumber: "asc" }],
  });
}

export async function upsertPostgameAudits(
  audits: PostgameAuditInput[]
): Promise<void> {
  for (const audit of audits) {
    await prisma.postgameChallengeAudit.upsert({
      where: { pitchEventId: audit.pitchEventId },
      update: {
        savantPitchEventId: audit.savantPitchEventId,
        savantZoneResult: audit.savantZoneResult,
        callWasProbablyWrong: audit.callWasProbablyWrong,
        shouldHaveChallenged: audit.shouldHaveChallenged,
        missedChallenge: audit.missedChallenge,
        badChallengeAllowed: audit.badChallengeAllowed,
        runExpectancySwing: audit.runExpectancySwing,
        notesJson: audit.notes,
        plateX: audit.plateX,
        plateZ: audit.plateZ,
        szTop: audit.szTop,
        szBot: audit.szBot,
      },
      create: {
        gamePk: audit.gamePk,
        atBatIndex: audit.atBatIndex,
        pitchNumber: audit.pitchNumber,
        pitchEventId: audit.pitchEventId,
        recommendationId: audit.recommendationId,
        savantPitchEventId: audit.savantPitchEventId,
        inning: audit.inning,
        halfInning: audit.halfInning,
        balls: audit.balls,
        strikes: audit.strikes,
        outs: audit.outs,
        batterId: audit.batterId,
        pitcherId: audit.pitcherId,
        originalCall: audit.originalCall,
        plateX: audit.plateX,
        plateZ: audit.plateZ,
        szTop: audit.szTop,
        szBot: audit.szBot,
        savantZoneResult: audit.savantZoneResult,
        callWasProbablyWrong: audit.callWasProbablyWrong,
        liveRecommendation: audit.liveRecommendation,
        playerConfidence: audit.playerConfidence,
        challengeAvailable: audit.challengeAvailable,
        shouldHaveChallenged: audit.shouldHaveChallenged,
        missedChallenge: audit.missedChallenge,
        badChallengeAllowed: audit.badChallengeAllowed,
        runExpectancySwing: audit.runExpectancySwing,
        notesJson: audit.notes,
      },
    });
  }
}

export async function findAuditsForGame(
  gamePk: number
): Promise<PostgameChallengeAudit[]> {
  return prisma.postgameChallengeAudit.findMany({
    where: { gamePk },
    orderBy: [{ runExpectancySwing: "desc" }, { atBatIndex: "asc" }],
  });
}
