import { prisma } from "./prisma";
import type { PostgameChallengeAudit } from "@prisma/client";

export type ZoneResult = "ball" | "strike" | "unknown";
export type OriginalCall = "ball" | "strike" | "unknown";

export interface PostgameAuditInput {
  gamePk: number;
  atBatIndex: number;
  pitchNumber: number;
  pitchEventId: number;
  recommendationId: number;
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
  zoneResult: ZoneResult;
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

export async function upsertPostgameAudits(
  audits: PostgameAuditInput[]
): Promise<void> {
  for (const audit of audits) {
    await prisma.postgameChallengeAudit.upsert({
      where: { pitchEventId: audit.pitchEventId },
      update: {
        zoneResult: audit.zoneResult,
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
        zoneResult: audit.zoneResult,
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
