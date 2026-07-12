import { computeChallengeOutcomeExpectancies } from "@abs/engine";
import type { Balls, Outs, Strikes } from "@abs/engine";
import { prisma } from "../db/prisma";
import { CALL_CODES } from "../db/constants";

export interface GainedRePitchContext {
  id: number;
  gamePk: number;
  atBatIndex: number;
  ballsBefore: number;
  strikesBefore: number;
  outs: number;
  callCode: string | null;
}

/** Raw RE swing from overturning a borderline pitch at this count and base/out state. */
export function rawOverturnReSwing(
  outs: number,
  ballsBefore: number,
  strikesBefore: number,
  runners: { first: boolean; second: boolean; third: boolean }
): number {
  const normalizedOuts = Math.min(Math.max(outs, 0), 2) as Outs;
  const { ifSucceeds, ifFails } = computeChallengeOutcomeExpectancies(
    normalizedOuts,
    ballsBefore as Balls,
    strikesBefore as Strikes,
    runners
  );
  return Math.max(0, ifSucceeds - ifFails);
}

/** Defensive RE benefit from overturning a called ball to a strike. */
export function fieldingOverturnReSwing(
  outs: number,
  ballsBefore: number,
  strikesBefore: number,
  runners: { first: boolean; second: boolean; third: boolean }
): number {
  return rawOverturnReSwing(outs, ballsBefore, strikesBefore, runners);
}

/**
 * Resolve gained RE for a successful overturn.
 *
 * Batting-side called-strike challenges prefer the stored audit RE when present.
 * Fielding-side ball challenges and any case without an audit row fall back to
 * the raw RE swing computed from the at-bat snapshot.
 */
export async function resolveGainedReForPitch(
  pitch: GainedRePitchContext
): Promise<number> {
  const [recByPitch, recByCount, audit, snapshot] = await Promise.all([
    prisma.challengeRecommendation.findFirst({
      where: { pitchEventId: pitch.id },
      select: { expectedValue: true },
    }),
    prisma.challengeRecommendation.findUnique({
      where: {
        gamePk_atBatIndex_balls_strikes: {
          gamePk: pitch.gamePk,
          atBatIndex: pitch.atBatIndex,
          balls: pitch.ballsBefore,
          strikes: pitch.strikesBefore,
        },
      },
      select: { expectedValue: true },
    }),
    prisma.postgameChallengeAudit.findUnique({
      where: { pitchEventId: pitch.id },
      select: { runExpectancySwing: true },
    }),
    prisma.liveGameSnapshot.findUnique({
      where: {
        gamePk_atBatIndex: {
          gamePk: pitch.gamePk,
          atBatIndex: pitch.atBatIndex,
        },
      },
      select: {
        outs: true,
        runnerOnFirst: true,
        runnerOnSecond: true,
        runnerOnThird: true,
      },
    }),
  ]);

  const recommendation = recByPitch ?? recByCount;

  if (pitch.callCode === CALL_CODES.CALLED_STRIKE) {
    if (audit && audit.runExpectancySwing > 0) {
      return audit.runExpectancySwing;
    }
    if (recommendation && recommendation.expectedValue > 0) {
      return recommendation.expectedValue;
    }
  }

  const runners = snapshot
    ? {
        first: snapshot.runnerOnFirst,
        second: snapshot.runnerOnSecond,
        third: snapshot.runnerOnThird,
      }
    : { first: false, second: false, third: false };

  const outs = snapshot?.outs ?? pitch.outs;
  return rawOverturnReSwing(outs, pitch.ballsBefore, pitch.strikesBefore, runners);
}
